// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.

import { AudioDraftKind, AudioDraftLine, AudioDraftMarking, AudioDraftResult } from 'src/app/generated/blueprint.api';

/*
 * Audio and video for a Gallery article, made in the planner's browser from the lines the API voiced: the lines joined with
 * pauses, through a telephone band-pass for a voicemail or call, with caption cues from each line's sentence timings. Video is
 * a title card, still or with a moving waveform, or a vertical news reel, encoded with WebCodecs (H.264 with AAC, or Opus
 * where the browser has no AAC encoder) and muxed into MP4 with mp4-muxer. Nothing here talks to a server.
 */

/** How a clip is shown: an audio player, a video of a still title card, or a video of the card with the voice's waveform */
export type ClipFormat = 'audio' | 'still' | 'waveform';

export interface EncoderSupport {
  h264: boolean;
  aac: boolean;
  opus: boolean;
}

/** A caption: seconds from the start of the clip */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** What a clip became */
export interface MediaClip {
  /** The media, with its transcript, to put into the article */
  html: string;
  /** Where it goes: Listen at the top, under the marking; the rest where the article's body starts */
  position: 'top' | 'body';
  /** What was made, which is audio when the browser cannot encode the video asked for */
  format: ClipFormat | 'reel';
  /** The video's audio codec, or mp3 or aac for audio alone */
  codec: 'aac' | 'opus' | 'mp3';
  seconds: number;
  /** What the planner should know: a fallback, a missing picture */
  notes: string[];
}

/** The browser work, which tests replace */
export interface MediaEnv {
  probe(): Promise<EncoderSupport>;
  /** MP3 bytes as mono samples at RATE */
  decode(mp3: Uint8Array): Promise<Float32Array>;
  /** The samples as if heard over a phone line */
  phone(pcm: Float32Array): Promise<Float32Array>;
  /** The samples alone as an MP4 audio file */
  encodeAudio(pcm: Float32Array, codec: 'aac' | 'opus'): Promise<Uint8Array>;
  /** Frames drawn by draw, over the samples, as an MP4 video */
  encodeVideo(video: VideoJob, pcm: Float32Array, codec: 'aac' | 'opus'): Promise<Uint8Array>;
  /** An image from a data URI, or null when it cannot be read */
  loadImage(src: string): Promise<CanvasImageSource & { width: number; height: number } | null>;
}

export interface VideoJob {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  /** Draws the frame at t seconds */
  draw(g: CanvasDrawingContext, t: number): void;
}

export type CanvasDrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const RATE = 48000;
const FONT = 'Arial, Helvetica, sans-serif';
const FONT_ATTRS = 'face="Arial, Helvetica, sans-serif"';

// ------------------------------------------------------------------------------------------------
// Pure parts

/** The pause between lines: a call's speakers answer quickly, a broadcast's take a breath */
export function gapMs(kind: AudioDraftKind): number {
  return kind === AudioDraftKind.Call ? 450 : kind === AudioDraftKind.Broadcast ? 600 : 400;
}

/** Where each line starts, in milliseconds, when they are laid end to end with a pause between */
export function lineOffsets(durationsMs: number[], gap: number): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (const duration of durationsMs) {
    offsets.push(at);
    at += duration + gap;
  }
  return offsets;
}

/** The caption cues of the lines: one a sentence, labelled with its speaker when asked; a line without timings is one cue */
export function buildCues(lines: AudioDraftLine[], durationsMs: number[], gap: number, labelSpeakers: boolean): Cue[] {
  const offsets = lineOffsets(durationsMs, gap);
  const cues: Cue[] = [];
  lines.forEach((line, i) => {
    const marks = line.marks?.length ? line.marks : [{ startMs: 0, text: line.text }];
    const lineEnd = offsets[i] + durationsMs[i];
    marks.forEach((mark, k) => {
      const start = offsets[i] + (mark.startMs ?? 0);
      const end = k + 1 < marks.length ? offsets[i] + (marks[k + 1].startMs ?? 0) : lineEnd;
      const text = (labelSpeakers && line.speaker ? line.speaker + ': ' : '') + (mark.text ?? '');
      cues.push({ start: start / 1000, end: Math.max(end, start + 1) / 1000, text });
    });
  });
  return cues;
}

/** The cues as a WebVTT file */
export function toWebVtt(cues: Cue[]): string {
  const time = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    const pad = (n: number, width = 2) => String(n).padStart(width, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
  };
  return 'WEBVTT\n\n' + cues.map((c) => `${time(c.start)} --> ${time(c.end)}\n${escapeVtt(c.text)}\n`).join('\n');
}

/**
 * What can be made of the format asked for. Video needs H.264 and an audio encoder; without them it is audio alone. Audio is
 * AAC where the browser can encode it; video falls back to Opus, which older Safari plays silent in MP4, so the MP3 is kept
 * beside it.
 */
export function chooseEncoding(format: ClipFormat, support: EncoderSupport): { format: ClipFormat; audio: 'aac' | 'opus' | 'mp3'; keepMp3: boolean; fellBack: boolean } {
  const video = format !== 'audio';
  if (video && support.h264 && (support.aac || support.opus)) {
    return { format, audio: support.aac ? 'aac' : 'opus', keepMp3: !support.aac, fellBack: false };
  }
  return { format: 'audio', audio: support.aac ? 'aac' : 'mp3', keepMp3: false, fellBack: video };
}

/** A reel's caption screens: two or three words each, no longer than 18 characters, breaking after a comma or full stop */
export function captionChunks(words: Cue[], maxWords = 3, maxChars = 18): { words: Cue[]; start: number; end: number }[] {
  const chunks: { words: Cue[]; start: number; end: number }[] = [];
  for (const word of words) {
    const last = chunks[chunks.length - 1];
    const lastWord = last?.words[last.words.length - 1];
    const joined = last ? [...last.words.map((w) => w.text), word.text].join(' ') : '';
    if (!last || last.words.length >= maxWords || joined.length > maxChars || /[.,!?;:]$/.test(lastWord.text)) {
      chunks.push({ words: [word], start: word.start, end: word.end });
    } else {
      last.words.push(word);
      last.end = word.end;
    }
  }
  // a screen stays up until the next, and the last a moment after its word
  chunks.forEach((c, i) => (c.end = i + 1 < chunks.length ? chunks[i + 1].start : c.end + 0.4));
  return chunks;
}

/** A line's words as timed cues, each lasting until the next starts and the last until the line ends */
export function timedWords(line: AudioDraftLine, offsetMs: number, durationMs: number): Cue[] {
  const words = line.words?.length ? line.words : [];
  return words.map((w, i) => ({
    text: w.text ?? '',
    start: (offsetMs + (w.startMs ?? 0)) / 1000,
    end: (offsetMs + (i + 1 < words.length ? words[i + 1].startMs ?? 0 : durationMs)) / 1000,
  }));
}

/** A reel's picture: its photo, or a card in the outlet's colour when it has none or the photo cannot be read */
export function reelPicture(result: AudioDraftResult, photoLoaded: boolean): 'photo' | 'card' {
  return result.photo && photoLoaded ? 'photo' : 'card';
}

/** An outlet's colour, the same each time for the same name */
export function outletColor(name: string): string {
  const colors = ['#B91C1C', '#1D4ED8', '#047857', '#7C2D12', '#6D28D9', '#0F766E', '#9D174D', '#1E3A8A'];
  let hash = 2166136261;
  for (const c of (name ?? '').trim().toLowerCase()) {
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  return colors[hash % colors.length];
}

/**
 * The article with the media in it. At the top means under the marking banner at the head of the article; the body is where
 * its first paragraph starts, or the top when it has none.
 */
export function insertMedia(html: string, media: string, position: 'top' | 'body'): string {
  const value = html ?? '';
  if (!value.trim()) {
    return media;
  }
  if (position === 'body') {
    const paragraph = value.search(/<p[\s>]/i);
    if (paragraph >= 0) {
      return value.slice(0, paragraph) + media + value.slice(paragraph);
    }
  }
  const markings = /^(\s*<table\b[^>]*\btitle="Marking"[^>]*>[\s\S]*?<\/table>)+/i.exec(value);
  const at = markings ? markings[0].length : 0;
  return value.slice(0, at) + media + value.slice(at);
}

/** "Listen to this article", with the player, as a bar of its own colours, so it reads the same in light and dark themes */
export function listenBar(audioSrc: string, seconds: number, voicedBy: string): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return (
    `<table width="720" cellpadding="10" cellspacing="0" border="0" bgcolor="#F3F4F6"><tbody><tr><td>` +
    `<font color="#111111" ${FONT_ATTRS} size="3"><b>Listen to this article</b></font>` +
    `<font color="#555555" ${FONT_ATTRS} size="2"> · ${minutes} min${voicedBy ? ' · voiced by ' + escapeHtml(voicedBy) : ''}</font><br>` +
    `<audio controls preload="metadata" src="${audioSrc}"></audio></td></tr></tbody></table>`
  );
}

/** The minutes and seconds of a clip, as a player shows them */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function audioHtml(src: string): string {
  return `<audio controls preload="metadata" src="${src}"></audio>`;
}

export function videoHtml(src: string, width: number, height: number, vtt: string | null): string {
  const track = vtt ? `<track default kind="captions" srclang="en" label="English" src="data:text/vtt;base64,${base64Text(vtt)}">` : '';
  return `<video controls preload="metadata" width="${width}" height="${height}"><source src="${src}" type="video/mp4">${track}</video>`;
}

// ------------------------------------------------------------------------------------------------
// Making the media

/** Makes the clip of an API answer in the format asked for, or the nearest the browser can encode */
export async function makeMedia(result: AudioDraftResult, format: ClipFormat, env: MediaEnv = browserMedia()): Promise<MediaClip> {
  const lines = (result.lines ?? []).filter((l) => !!l.audio);
  if (!lines.length) {
    throw new Error('Nothing was voiced.');
  }
  if (result.kind === AudioDraftKind.Listen) {
    // the article is its own transcript, so the MP3 goes in as it came
    const seconds = lines.reduce((n, l) => n + (l.durationMs ?? 0), 0) / 1000;
    return { html: listenBar(lines[0].audio, seconds, lines[0].speaker), position: 'top', format: 'audio', codec: 'mp3', seconds, notes: [] };
  }
  if (result.kind === AudioDraftKind.Reel) {
    return makeReel(result, env);
  }

  const support = await env.probe();
  const choice = chooseEncoding(format, support);
  const notes = choice.fellBack ? ['This browser cannot encode video, so the clip is audio only.'] : [];
  const transcript = result.transcript ?? '';
  const mp3 = joinMp3(lines);
  // one plain line needs no mixing at all
  if (choice.format === 'audio' && (choice.audio === 'mp3' || (lines.length === 1 && !result.phone))) {
    if (result.phone && choice.audio === 'mp3') {
      notes.push('This browser cannot encode AAC audio, so the clip is without the phone-line sound.');
    }
    const seconds = lines.reduce((n, l) => n + (l.durationMs ?? 0), 0) / 1000;
    return { html: audioHtml(mp3) + transcript, position: 'body', format: 'audio', codec: 'mp3', seconds, notes };
  }

  const gap = gapMs(result.kind);
  const decoded = await Promise.all(lines.map((l) => env.decode(dataUriBytes(l.audio))));
  const durations = decoded.map((d) => Math.round((d.length / RATE) * 1000));
  let pcm = joinPcm(decoded, Math.round((gap / 1000) * RATE), Math.round(0.3 * RATE));
  if (result.phone) {
    pcm = await env.phone(pcm);
  }
  const seconds = pcm.length / RATE;
  if (choice.format === 'audio') {
    const m4a = await env.encodeAudio(pcm, 'aac');
    return { html: audioHtml('data:audio/mp4;base64,' + bytesBase64(m4a)) + transcript, position: 'body', format: 'audio', codec: 'aac', seconds, notes };
  }

  const cues = buildCues(lines, durations, gap, result.kind === AudioDraftKind.Call);
  const width = 640;
  const height = 360;
  const card = titleCard(result, lines);
  const waveform = choice.format === 'waveform';
  const mp4 = await env.encodeVideo(
    {
      width,
      height,
      fps: waveform ? 15 : 5,
      bitrate: waveform ? 400_000 : 150_000,
      draw: (g, t) => {
        card(g, width, height);
        if (waveform) {
          drawWaveform(g, pcm, t, 15, width, height, result.phone);
        }
      },
    },
    pcm,
    choice.audio as 'aac' | 'opus'
  );
  let html = videoHtml('data:video/mp4;base64,' + bytesBase64(mp4), width, height, toWebVtt(cues));
  if (choice.keepMp3) {
    // Opus in MP4 plays silent in older Safari
    html += '<br>' + audioHtml(mp3);
    notes.push('This browser has no AAC encoder, so the video has Opus audio and the MP3 is kept beside it for browsers that cannot play Opus.');
  }
  return { html: html + transcript, position: 'body', format: choice.format, codec: choice.audio as 'aac' | 'opus', seconds, notes };
}

/**
 * A vertical news reel: the photo filling the height, panning and slowly zooming, under the marking, the outlet's strip and
 * handle, a BREAKING tag and the headline; captions burned in a few words at a time with the word being said in yellow; an end
 * card for the last three seconds. Social video is watched muted, so the captions are the point.
 */
export async function makeReel(result: AudioDraftResult, env: MediaEnv = browserMedia()): Promise<MediaClip> {
  const notes: string[] = [];
  const support = await env.probe();
  const line = result.lines[0];
  const post = result.post ? `<p><font ${FONT_ATTRS}>${escapeHtml(result.post)}</font></p>` : '';
  if (!support.h264 || !(support.aac || support.opus)) {
    notes.push('This browser cannot encode video, so the reel is the post with its audio. Make it in Chrome or Edge for the video.');
    const seconds = (line.durationMs ?? 0) / 1000;
    return { html: post + audioHtml(line.audio) + (result.transcript ?? ''), position: 'body', format: 'audio', codec: 'mp3', seconds, notes };
  }
  const codec = support.aac ? 'aac' : 'opus';
  const voice = await env.decode(dataUriBytes(line.audio));
  const lead = 0.4;
  const tail = 3.4;
  const pcm = new Float32Array(voice.length + Math.round((lead + tail) * RATE));
  pcm.set(voice, Math.round(lead * RATE));
  const duration = pcm.length / RATE;
  const words = timedWords(line, lead * 1000, Math.round((voice.length / RATE) * 1000));
  const chunks = captionChunks(words);
  const photo = result.photo ? await env.loadImage(result.photo) : null;
  const picture = reelPicture(result, !!photo);
  if (picture === 'card') {
    notes.push(result.photo ? 'The photo could not be read, so the reel is on a plain card.' : 'The reel has no photo, so it is on a plain card.');
  }
  const outlet = result.outlet || result.title || 'News';
  const handle = result.handle || '';
  const color = outletColor(outlet);
  const W = 720;
  const H = 1280;
  const mp4 = await env.encodeVideo(
    {
      width: W,
      height: H,
      fps: 24,
      bitrate: 700_000,
      draw: (g, t) => drawReelFrame(g, { W, H, t, duration, photo: picture === 'photo' ? photo : null, color, outlet, handle, headline: result.headline, marking: result.marking, chunks }),
    },
    pcm,
    codec
  );
  let html =
    post +
    `<video controls preload="metadata" width="360" height="640"><source src="data:video/mp4;base64,${bytesBase64(mp4)}" type="video/mp4"></video>`;
  if (codec === 'opus') {
    html += '<br>' + audioHtml(line.audio);
    notes.push('This browser has no AAC encoder, so the reel has Opus audio and the MP3 is kept beside it for browsers that cannot play Opus.');
  }
  return { html: html + (result.transcript ?? ''), position: 'body', format: 'reel', codec, seconds: duration, notes };
}

// ------------------------------------------------------------------------------------------------
// Drawing

/** The title card of a voicemail, an intercept or a broadcast, with the MSEL's marking across the top */
export function titleCard(result: AudioDraftResult, lines: AudioDraftLine[]): (g: CanvasDrawingContext, W: number, H: number) => void {
  const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
  return (g, W, H) => {
    const kind = result.kind;
    const intercept = kind === AudioDraftKind.Call;
    const broadcast = kind === AudioDraftKind.Broadcast;
    const color = broadcast ? outletColor(result.title) : intercept ? '#0B1410' : '#1E293B';
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    const top = drawMarking(g, result.marking, W, 13);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    if (intercept) {
      g.fillStyle = '#86EFAC';
      g.font = `bold 30px "Courier New", monospace`;
      g.fillText('INTERCEPT', 40, top + 60);
      g.fillStyle = '#4ADE80';
      g.font = `15px "Courier New", monospace`;
      ['SOURCE: VOICE', `PARTIES: ${speakers.length}`, ...wrap(g, (result.headline ?? '').toUpperCase(), W - 80).slice(0, 3)].forEach((text, i) =>
        g.fillText(text, 40, top + 100 + i * 24)
      );
    } else if (broadcast) {
      g.fillStyle = '#FFFFFF';
      g.font = `900 44px ${FONT}`;
      wrap(g, (result.title ?? 'News').toUpperCase(), W - 80).slice(0, 1).forEach((text) => g.fillText(text, 40, top + 90));
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, top + 130, W, 54);
      g.fillStyle = color;
      g.font = `bold 22px ${FONT}`;
      g.fillText(fit(g, (result.headline ?? '').toUpperCase(), W - 80), 40, top + 165);
    } else {
      g.fillStyle = '#FFFFFF';
      g.font = `bold 34px ${FONT}`;
      g.fillText((result.title ?? 'Voicemail').toUpperCase(), 40, top + 70);
      g.fillStyle = '#CBD5E1';
      g.font = `18px ${FONT}`;
      g.fillText(fit(g, speakers.length ? 'From ' + speakers[0] : '', W - 80), 40, top + 104);
      wrap(g, result.headline ?? '', W - 80).slice(0, 2).forEach((text, i) => g.fillText(text, 40, top + 136 + i * 26));
    }
  };
}

/** The voice's level around t as bars across the lower part of the card */
function drawWaveform(g: CanvasDrawingContext, pcm: Float32Array, t: number, fps: number, W: number, H: number, phone: boolean) {
  const start = Math.floor(t * RATE);
  const columns = 140;
  const per = RATE / fps / columns;
  const base = H - 70;
  g.fillStyle = phone ? '#4ADE80' : '#FFFFFF';
  for (let c = 0; c < columns; c++) {
    let peak = 0;
    for (let s = Math.floor(start + c * per); s < start + (c + 1) * per && s < pcm.length; s++) {
      peak = Math.max(peak, Math.abs(pcm[s]));
    }
    const h = Math.max(1, Math.sqrt(peak) * 40);
    g.fillRect(40 + c * 4, base - h, 3, h * 2);
  }
}

interface ReelFrame {
  W: number;
  H: number;
  t: number;
  duration: number;
  photo: (CanvasImageSource & { width: number; height: number }) | null;
  color: string;
  outlet: string;
  handle: string;
  headline: string;
  marking: AudioDraftMarking;
  chunks: { words: Cue[]; start: number; end: number }[];
}

function drawReelFrame(g: CanvasDrawingContext, f: ReelFrame) {
  const { W, H, t, duration } = f;
  const p = duration > 0 ? t / duration : 0;
  if (f.photo) {
    // the photo fills the height and pans left to right while it zooms in by 8%
    const zoom = 1 + 0.08 * p;
    const h = H * zoom;
    const w = f.photo.width * (h / f.photo.height);
    g.drawImage(f.photo, -(w - W) * p, -(h - H) / 2, w, h);
  } else {
    const card = g.createLinearGradient(0, 0, W, H);
    card.addColorStop(0, f.color);
    card.addColorStop(1, '#111111');
    g.fillStyle = card;
    g.fillRect(0, 0, W, H);
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.55)');
  shade.addColorStop(0.3, 'rgba(0,0,0,0)');
  shade.addColorStop(0.6, 'rgba(0,0,0,0.15)');
  shade.addColorStop(1, 'rgba(0,0,0,0.8)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  const top = drawMarking(g, f.marking, W, 18);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = `900 34px ${FONT}`;
  const name = fit(g, f.outlet.toUpperCase(), 300);
  const nameWidth = g.measureText(name).width + 32;
  g.fillStyle = f.color;
  g.fillRect(36, top + 36, nameWidth, 60);
  g.fillStyle = '#FFFFFF';
  g.fillText(name, 52, top + 67);
  g.font = `22px ${FONT}`;
  g.fillText(fit(g, f.handle, W - nameWidth - 72), 36 + nameWidth + 16, top + 67);

  if (t < duration - 3.4) {
    g.fillStyle = f.color;
    g.fillRect(36, H - 330, 150, 40);
    g.fillStyle = '#FFFFFF';
    g.font = `bold 22px ${FONT}`;
    g.fillText('BREAKING', 50, H - 310);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fillRect(36, H - 284, W - 72, 120);
    g.fillStyle = '#111111';
    g.font = `bold 34px ${FONT}`;
    wrap(g, f.headline ?? '', W - 112).slice(0, 2).forEach((text, n) => g.fillText(text, 56, H - 246 + n * 44));
  } else {
    g.fillStyle = f.color;
    g.fillRect(0, H / 2 - 90, W, 180);
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.font = `900 64px ${FONT}`;
    g.fillText(fit(g, f.outlet.toUpperCase(), W - 60), W / 2, H / 2 - 20);
    g.font = `28px ${FONT}`;
    if (f.handle) {
      g.fillText(`Follow ${f.handle} for updates`, W / 2, H / 2 + 44);
    }
  }

  const chunk = f.chunks.find((c) => t >= c.start && t < c.end);
  if (chunk) {
    g.font = `900 58px ${FONT}`;
    g.textAlign = 'left';
    g.lineJoin = 'round';
    const widths = chunk.words.map((w) => g.measureText(w.text + ' ').width);
    let x = (W - widths.reduce((a, b) => a + b, 0) + g.measureText(' ').width) / 2;
    chunk.words.forEach((word, k) => {
      const speaking = t >= word.start && t < word.end;
      g.lineWidth = 10;
      g.strokeStyle = '#000000';
      g.strokeText(word.text, x, H * 0.58);
      g.fillStyle = speaking ? '#FDE047' : '#FFFFFF';
      g.fillText(word.text, x, H * 0.58);
      x += widths[k];
    });
  }
}

/** The marking bar across the top, in the article banner's words and colours; answers where the card below it starts */
function drawMarking(g: CanvasDrawingContext, marking: AudioDraftMarking | null | undefined, W: number, size: number): number {
  if (!marking?.text) {
    return 0;
  }
  const height = Math.round(size * 2);
  g.fillStyle = marking.background || '#FDB516';
  g.fillRect(0, 0, W, height);
  g.fillStyle = marking.color || '#000000';
  g.font = `bold ${size}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(fit(g, marking.text, W - 20), W / 2, height / 2 + 1);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  return height;
}

function wrap(g: CanvasDrawingContext, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of (text ?? '').split(/\s+/).filter((w) => w)) {
    const next = line ? line + ' ' + word : word;
    if (g.measureText(next).width > max && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    out.push(line);
  }
  return out;
}

function fit(g: CanvasDrawingContext, text: string, max: number): string {
  let value = text ?? '';
  while (value.length > 1 && g.measureText(value).width > max) {
    value = value.slice(0, -2) + '…';
  }
  return value;
}

// ------------------------------------------------------------------------------------------------
// Bytes

/** The lines' MP3 frames end to end, which plays as one file */
export function joinMp3(lines: AudioDraftLine[]): string {
  if (lines.length === 1) {
    return lines[0].audio;
  }
  const parts = lines.map((l) => dataUriBytes(l.audio));
  const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return 'data:audio/mpeg;base64,' + bytesBase64(joined);
}

export function joinPcm(parts: Float32Array[], gapSamples: number, tailSamples: number): Float32Array {
  const total = parts.reduce((n, p) => n + p.length, 0) + gapSamples * Math.max(0, parts.length - 1) + tailSamples;
  const joined = new Float32Array(total);
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length + gapSamples;
  }
  return joined;
}

export function dataUriBytes(uri: string): Uint8Array {
  const base64 = uri.slice(uri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64Text(text: string): string {
  return bytesBase64(new TextEncoder().encode(text));
}

function escapeHtml(text: string): string {
  return (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeVtt(text: string): string {
  return (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/-->/g, '->');
}

// ------------------------------------------------------------------------------------------------
// The browser's encoders

/** WebCodecs, Web Audio and mp4-muxer, as the browser has them */
export function browserMedia(): MediaEnv {
  return {
    probe: async () => {
      if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
        return { h264: false, aac: false, opus: false };
      }
      const supported = (check: Promise<{ supported?: boolean }>) => check.then((r) => !!r.supported).catch(() => false);
      const [h264, aac, opus] = await Promise.all([
        supported(VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width: 720, height: 1280, bitrate: 700_000, framerate: 24 })),
        supported(AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: RATE, numberOfChannels: 1, bitrate: 64000 })),
        supported(AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: RATE, numberOfChannels: 1, bitrate: 64000 })),
      ]);
      return { h264, aac, opus };
    },
    decode: async (mp3) => {
      const context = new OfflineAudioContext(1, 1, RATE);
      const buffer = await context.decodeAudioData(mp3.slice().buffer);
      return buffer.getChannelData(0);
    },
    phone: async (pcm) => {
      // a phone line: 300 to 3,400 Hz, a little hiss, slightly overdriven
      const context = new OfflineAudioContext(1, pcm.length, RATE);
      const buffer = context.createBuffer(1, pcm.length, RATE);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) {
        data[i] = pcm[i] + (Math.random() - 0.5) * 0.006;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const high = context.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = 300;
      const low = context.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 3400;
      const drive = context.createWaveShaper();
      drive.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 1023) * 2 - 1) * 2.2) / Math.tanh(2.2));
      const gain = context.createGain();
      gain.gain.value = 0.9;
      source.connect(high).connect(low).connect(drive).connect(gain).connect(context.destination);
      source.start();
      return (await context.startRendering()).getChannelData(0);
    },
    encodeAudio: async (pcm, codec) => {
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        audio: { codec, numberOfChannels: 1, sampleRate: RATE },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });
      await encodePcm(pcm, codec, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
      muxer.finalize();
      return new Uint8Array(muxer.target.buffer);
    },
    encodeVideo: async (job, pcm, codec) => {
      const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: job.width, height: job.height, frameRate: job.fps },
        audio: { codec, numberOfChannels: 1, sampleRate: RATE },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });
      let failure: unknown = null;
      const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
      encoder.configure({ codec: 'avc1.42001f', width: job.width, height: job.height, bitrate: job.bitrate, framerate: job.fps, avc: { format: 'avc' } });
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(job.width, job.height) : Object.assign(document.createElement('canvas'), { width: job.width, height: job.height });
      const g = canvas.getContext('2d') as CanvasDrawingContext;
      const frames = Math.ceil((pcm.length / RATE) * job.fps);
      for (let i = 0; i < frames && !failure; i++) {
        const t = i / job.fps;
        job.draw(g, t);
        const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / job.fps) });
        encoder.encode(frame, { keyFrame: i % (job.fps * 2) === 0 });
        frame.close();
        // let the encoder catch up, and the page breathe
        if (encoder.encodeQueueSize > 8) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      await encoder.flush();
      encoder.close();
      if (failure) {
        throw failure;
      }
      await encodePcm(pcm, codec, (chunk, meta) => muxer.addAudioChunk(chunk, meta));
      muxer.finalize();
      return new Uint8Array(muxer.target.buffer);
    },
    loadImage: async (src) => {
      try {
        const blob = await (await fetch(src)).blob();
        return await createImageBitmap(blob);
      } catch {
        return null;
      }
    },
  };
}

async function encodePcm(pcm: Float32Array, codec: 'aac' | 'opus', output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void) {
  let failure: unknown = null;
  const encoder = new AudioEncoder({ output, error: (e) => (failure = e) });
  encoder.configure({ codec: codec === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate: RATE, numberOfChannels: 1, bitrate: 64000 });
  for (let s = 0; s < pcm.length && !failure; s += 960) {
    const slice = pcm.slice(s, Math.min(s + 960, pcm.length));
    encoder.encode(new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: slice.length, numberOfChannels: 1, timestamp: Math.round((s / RATE) * 1e6), data: slice }));
  }
  await encoder.flush();
  encoder.close();
  if (failure) {
    throw failure;
  }
}
