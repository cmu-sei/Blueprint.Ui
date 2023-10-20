export abstract class HtmlToText {

  public static extractContent(s, space) {
    var span= document.createElement('span');
    span.innerHTML= s;
    if(space) {
      var children = span.querySelectorAll('*') as NodeListOf<HTMLBaseElement>;
      for(var i = 0 ; i < children.length ; i++) {
        if(children[i].textContent)
          children[i].textContent += ' ';
        else
          children[i].innerText += ' ';
        }
      }
      let textString =  [span.textContent || span.innerText].toString().replace(/ +/g,' ');
      if (textString.endsWith('>')) {
        textString = textString.substring(0, textString.length - 2);
      }
      return textString;
    };
}

