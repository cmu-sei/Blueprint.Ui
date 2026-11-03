// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { AudioDraftKind, AudioDraftLine, AudioDraftResult } from 'src/app/generated/blueprint.api';
import {
  buildCues,
  captionChunks,
  chooseEncoding,
  clock,
  CanvasDrawingContext,
  dataUriBytes,
  EncoderSupport,
  insertMedia,
  joinMp3,
  lineOffsets,
  listenBar,
  makeMedia,
  MediaEnv,
  outletColor,
  RATE,
  reelPicture,
  timedWords,
  toWebVtt,
  VideoJob,
} from './media-clip';

const MP3_A = 'data:audio/mpeg;base64,QUFB'; // "AAA"
const MP3_B = 'data:audio/mpeg;base64,QkJC'; // "BBB"

function line(speaker: string, audio: string, durationMs: number, marks: [number, string][] = [], words: [number, string][] = []): AudioDraftLine {
  return {
    speaker,
    voice: 'Matthew',
    text: marks.map((m) => m[1]).join(' '),
    audio,
    durationMs,
    marks: marks.map(([startMs, text]) => ({ startMs, text })),
    words: words.map(([startMs, text]) => ({ startMs, text })),
  };
}

// a canvas that draws nothing, and measures each character as 10 pixels
function fakeContext(): CanvasDrawingContext {
  return new Proxy({} as CanvasDrawingContext, {
    get: (target, name) => {
      if (name === 'measureText') {
        return (text: string) => ({ width: text.length * 10 });
      }
      if (name === 'createLinearGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      return name in target ? (target as any)[name] : () => undefined;
    },
    set: (target, name, value) => {
      (target as any)[name] = value;
      return true;
    },
  });
}

// the browser's encoders replaced: each MP3 byte decodes to a millisecond of samples
function fakeEnv(support: EncoderSupport, photo = true) {
  const jobs: VideoJob[] = [];
  const env: MediaEnv & { jobs: VideoJob[] } = {
    jobs,
    probe: vi.fn(async () => support),
    decode: vi.fn(async (mp3: Uint8Array) => new Float32Array(mp3.length * (RATE / 1000))),
    phone: vi.fn(async (pcm: Float32Array) => pcm.map(() => 0.5)),
    encodeAudio: vi.fn(async () => new Uint8Array([1, 2, 3])),
    encodeVideo: vi.fn(async (job: VideoJob) => {
      jobs.push(job);
      // a few frames, to be sure each draws
      [0, 0.5, 100].forEach((t) => job.draw(fakeContext(), t));
      return new Uint8Array([4, 5, 6]);
    }),
    loadImage: vi.fn(async () => (photo ? ({ width: 1280, height: 720 } as any) : null)),
  };
  return env;
}

const ALL: EncoderSupport = { h264: true, aac: true, opus: true };

describe('media-clip', () => {
  /**
   * Verifies: lines laid end to end with a pause between start where the ones before them, and their pauses, end.
   * Data: lines of 1,000, 2,000 and 500 ms with a 450 ms pause.
   */
  it('lays lines end to end with a pause between', () => {
    expect(lineOffsets([1000, 2000, 500], 450)).toEqual([0, 1450, 3900]);
  });

  /**
   * Verifies: each sentence mark becomes a cue that lasts until the next sentence, or the end of its line; a call's cues
   * name their speaker.
   * Data: two lines, the first with two sentences, a 450 ms pause.
   */
  it('builds a cue for each sentence, labelled with its speaker', () => {
    const lines = [line('CALLER 1', MP3_A, 2000, [[0, 'Are you seeing it?'], [1200, 'Both dropped.']]), line('CALLER 2', MP3_B, 1000, [[100, 'I see it.']])];

    expect(buildCues(lines, [2000, 1000], 450, true)).toEqual([
      { start: 0, end: 1.2, text: 'CALLER 1: Are you seeing it?' },
      { start: 1.2, end: 2, text: 'CALLER 1: Both dropped.' },
      { start: 2.55, end: 3.45, text: 'CALLER 2: I see it.' },
    ]);
    expect(buildCues(lines, [2000, 1000], 450, false)[0].text).toBe('Are you seeing it?');
  });

  /**
   * Verifies: the cues are written as WebVTT, with times to the millisecond and markup escaped.
   * Data: one cue at 61.5 s.
   */
  it('writes the cues as WebVTT', () => {
    expect(toWebVtt([{ start: 61.5, end: 62.25, text: 'A <b> & --> c' }])).toBe('WEBVTT\n\n00:01:01.500 --> 00:01:02.250\nA &lt;b> &amp; -> c\n');
  });

  /**
   * Verifies: video needs H.264 and an audio encoder, AAC first; with only Opus the MP3 is kept beside the video; with no video
   * encoder a video format falls back to audio alone.
   * Data: each combination of encoders.
   */
  it('chooses what the browser can encode', () => {
    expect(chooseEncoding('waveform', ALL)).toEqual({ format: 'waveform', audio: 'aac', keepMp3: false, fellBack: false });
    expect(chooseEncoding('still', { h264: true, aac: false, opus: true })).toEqual({ format: 'still', audio: 'opus', keepMp3: true, fellBack: false });
    expect(chooseEncoding('still', { h264: false, aac: true, opus: true })).toEqual({ format: 'audio', audio: 'aac', keepMp3: false, fellBack: true });
    expect(chooseEncoding('waveform', { h264: true, aac: false, opus: false })).toEqual({ format: 'audio', audio: 'mp3', keepMp3: false, fellBack: true });
    expect(chooseEncoding('audio', { h264: true, aac: false, opus: true })).toEqual({ format: 'audio', audio: 'mp3', keepMp3: false, fellBack: false });
  });

  /**
   * Verifies: a reel's captions are a few words a screen: at most three words and 18 characters, breaking after a comma or full
   * stop, each screen up until the next and the last a moment after its word.
   * Data: seven timed words.
   */
  it('breaks a reel caption into short screens', () => {
    const words = ['Two', 'stations,', 'offline', 'tonight', 'after', 'an', 'intrusion.'].map((text, i) => ({ text, start: i * 0.3, end: i * 0.3 + 0.3 }));

    const chunks = captionChunks(words);

    // "after an intrusion." would be 19 characters
    expect(chunks.map((c) => c.words.map((w) => w.text).join(' '))).toEqual(['Two stations,', 'offline tonight', 'after an', 'intrusion.']);
    expect(chunks.map((c) => [c.start, c.end].map((n) => +n.toFixed(2)))).toEqual([[0, 0.6], [0.6, 1.2], [1.2, 1.8], [1.8, 2.5]]);
  });

  /**
   * Verifies: a line's word marks become timed words after the lead-in, the last lasting to the end of the line.
   * Data: three words in a 1,500 ms line, 400 ms of lead-in.
   */
  it('times the words of a line', () => {
    const timed = timedWords(line('Anchor', MP3_A, 1500, [], [[0, 'Pumps'], [400, 'are'], [700, 'down.']]), 400, 1500);

    expect(timed).toEqual([
      { text: 'Pumps', start: 0.4, end: 0.8 },
      { text: 'are', start: 0.8, end: 1.1 },
      { text: 'down.', start: 1.1, end: 1.9 },
    ]);
  });

  /**
   * Verifies: a reel shows its photo when it has one that loads, and the outlet's card otherwise; an outlet keeps its colour.
   * Data: with and without a photo.
   */
  it('chooses the reel picture and the outlet colour', () => {
    expect(reelPicture({ photo: 'data:image/jpeg;base64,AA' }, true)).toBe('photo');
    expect(reelPicture({ photo: 'data:image/jpeg;base64,AA' }, false)).toBe('card');
    expect(reelPicture({ photo: null }, false)).toBe('card');
    expect(outletColor('WPN News')).toBe(outletColor(' wpn news '));
    expect(outletColor('WPN News')).toMatch(/^#[0-9A-F]{6}$/);
  });

  /**
   * Verifies: Listen goes under the marking at the top; the others go where the first paragraph starts; an empty field is
   * just the media.
   * Data: an article with a marking banner, a masthead and paragraphs.
   */
  it('puts the media where it belongs in the article', () => {
    const article = '<table title="Marking"><tr><td>EXERCISE</td></tr></table><table><tr><td><h1>Pumps stop</h1><p>One.</p></td></tr></table>';

    expect(insertMedia(article, '<audio></audio>', 'top')).toBe(
      '<table title="Marking"><tr><td>EXERCISE</td></tr></table><audio></audio><table><tr><td><h1>Pumps stop</h1><p>One.</p></td></tr></table>'
    );
    expect(insertMedia(article, '<video></video>', 'body')).toBe(
      '<table title="Marking"><tr><td>EXERCISE</td></tr></table><table><tr><td><h1>Pumps stop</h1><video></video><p>One.</p></td></tr></table>'
    );
    expect(insertMedia('<div>No paragraphs</div>', '<video></video>', 'body')).toBe('<video></video><div>No paragraphs</div>');
    expect(insertMedia('', '<video></video>', 'body')).toBe('<video></video>');
  });

  /**
   * Verifies: the MP3 frames of the lines join into one file, which plays as one.
   * Data: two three-byte lines.
   */
  it('joins the lines MP3 frames', () => {
    expect(Array.from(dataUriBytes(joinMp3([line('A', MP3_A, 0), line('B', MP3_B, 0)])))).toEqual([65, 65, 65, 66, 66, 66]);
    expect(joinMp3([line('A', MP3_A, 0)])).toBe(MP3_A);
    expect(clock(61.4)).toBe('1:01');
  });

  /**
   * Verifies: Listen is the "Listen to this article" bar with the MP3 as it came, at the top, with no encoding at all.
   * Data: a 90-second reading by WPN News.
   */
  it('makes Listen a bar with the MP3 as it came', async () => {
    const env = fakeEnv(ALL);

    const clip = await makeMedia({ kind: AudioDraftKind.Listen, lines: [line('WPN News', MP3_A, 90_000)] }, 'waveform', env);

    expect(clip.position).toBe('top');
    expect(clip.html).toBe(listenBar(MP3_A, 90, 'WPN News'));
    expect(clip.html).toContain('Listen to this article');
    expect(clip.html).toContain('2 min · voiced by WPN News');
    expect(env.probe).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a waveform video of a call is H.264 with AAC, a captions track of its cues, and the transcript; the phone sound is
   * applied before encoding.
   * Interacts with: the replaced encoders.
   * Data: a two-line call.
   */
  it('makes a captioned waveform video of a call', async () => {
    const env = fakeEnv(ALL);
    const result: AudioDraftResult = {
      kind: AudioDraftKind.Call,
      phone: true,
      title: 'Intercept',
      headline: 'Relay chatter',
      marking: { text: 'EXERCISE · EXERCISE · EXERCISE', background: '#FDB516', color: '#000000' },
      transcript: '<details><summary><b>Transcript</b></summary></details>',
      lines: [line('CALLER 1', MP3_A, 3, [[0, 'Seeing it?']]), line('CALLER 2', MP3_B, 3, [[0, 'Yes.']])],
    };

    const clip = await makeMedia(result, 'waveform', env);

    expect(env.phone).toHaveBeenCalledTimes(1);
    expect(env.encodeVideo).toHaveBeenCalledWith(expect.objectContaining({ width: 640, height: 360, fps: 15 }), expect.any(Float32Array), 'aac');
    expect((env.encodeVideo as any).mock.calls[0][1][0]).toBe(0.5);
    expect(clip).toMatchObject({ format: 'waveform', codec: 'aac', position: 'body', notes: [] });
    expect(clip.html).toContain('<video controls preload="metadata" width="640" height="360"><source src="data:video/mp4;base64,BAUG" type="video/mp4">');
    const vtt = atob(/data:text\/vtt;base64,([^"]+)/.exec(clip.html)[1]);
    expect(vtt).toContain('CALLER 2: Yes.');
    expect(clip.html).toMatch(/<\/video><details>/);
  });

  /**
   * Verifies: with only Opus, the video keeps the MP3 player beside it and says why.
   * Data: a one-line broadcast, still card.
   */
  it('keeps the MP3 beside an Opus video', async () => {
    const env = fakeEnv({ h264: true, aac: false, opus: true });

    const clip = await makeMedia({ kind: AudioDraftKind.Broadcast, title: 'WPN News', lines: [line('Anchor', MP3_A, 3, [[0, 'Good evening.']])] }, 'still', env);

    expect(clip).toMatchObject({ format: 'still', codec: 'opus' });
    expect(env.jobs[0].fps).toBe(5);
    expect(clip.html).toContain(`</video><br><audio controls preload="metadata" src="${MP3_A}"></audio>`);
    expect(clip.notes[0]).toContain('Opus');
  });

  /**
   * Verifies: without a video encoder, a video format falls back to audio alone, the voicemail's phone sound encoded as AAC.
   * Data: a one-line voicemail.
   */
  it('falls back to audio when the browser cannot encode video', async () => {
    const env = fakeEnv({ h264: false, aac: true, opus: true });

    const clip = await makeMedia({ kind: AudioDraftKind.Voicemail, phone: true, transcript: '<details></details>', lines: [line('Dana', MP3_A, 3)] }, 'waveform', env);

    expect(env.encodeVideo).not.toHaveBeenCalled();
    expect(env.encodeAudio).toHaveBeenCalledWith(expect.any(Float32Array), 'aac');
    expect(clip.html).toBe('<audio controls preload="metadata" src="data:audio/mp4;base64,AQID"></audio><details></details>');
    expect(clip.notes).toEqual(['This browser cannot encode video, so the clip is audio only.']);
  });

  /**
   * Verifies: audio alone of a plain single line is its MP3, with nothing decoded or encoded.
   * Data: a one-line broadcast, audio only.
   */
  it('uses a single plain line as it came for audio only', async () => {
    const env = fakeEnv(ALL);

    const clip = await makeMedia({ kind: AudioDraftKind.Broadcast, lines: [line('Anchor', MP3_A, 3000)] }, 'audio', env);

    expect(clip.html).toBe(`<audio controls preload="metadata" src="${MP3_A}"></audio>`);
    expect(env.decode).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a reel is a 720 by 1280 video at 24 frames a second, with its post above and the transcript below, on its photo.
   * Data: a reel line with words, a photo and a post.
   */
  it('makes a vertical reel with its post', async () => {
    const env = fakeEnv(ALL);
    const result: AudioDraftResult = {
      kind: AudioDraftKind.Reel,
      outlet: 'WPN',
      handle: '@WPNNews',
      headline: 'Pumps stop',
      post: 'Two stations offline. #WPN',
      photo: 'data:image/jpeg;base64,AA',
      transcript: '<details></details>',
      lines: [line('Anchor', MP3_A, 3, [], [[0, 'Two'], [1, 'stations'], [2, 'down.']])],
    };

    const clip = await makeMedia(result, 'audio', env);

    expect(env.encodeVideo).toHaveBeenCalledWith(expect.objectContaining({ width: 720, height: 1280, fps: 24 }), expect.any(Float32Array), 'aac');
    expect(clip).toMatchObject({ format: 'reel', codec: 'aac', notes: [] });
    expect(clip.html).toBe(
      '<p><font face="Arial, Helvetica, sans-serif">Two stations offline. #WPN</font></p><video controls preload="metadata" width="360" height="640"><source src="data:video/mp4;base64,BAUG" type="video/mp4"></video><details></details>'
    );
    // 400 ms of lead-in and 3.4 s for the end card around the voice
    expect(clip.seconds).toBeCloseTo(0.003 + 3.8, 3);
  });

  /**
   * Verifies: a reel whose photo cannot be read is drawn on the outlet's card, and says so.
   * Data: a reel with an unreadable photo.
   */
  it('draws a reel on a card when its photo cannot be read', async () => {
    const env = fakeEnv(ALL, false);

    const clip = await makeMedia({ kind: AudioDraftKind.Reel, photo: 'data:image/jpeg;base64,AA', lines: [line('Anchor', MP3_A, 3)] }, 'audio', env);

    expect(clip.notes).toEqual(['The photo could not be read, so the reel is on a plain card.']);
  });
});
