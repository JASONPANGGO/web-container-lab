import { WebContainer } from '@webcontainer/api';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { files } from './file';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="container">
  <div class="editor">
    <textarea>I am a textarea</textarea>
  </div>
  <div class="preview">
    <iframe src="loading.html"></iframe>
  </div>
  </div>
  <div class="terminal"></div>
  `

/** @type {HTMLIFrameElement | null} */
const iframeEl: HTMLIFrameElement = document.querySelector('iframe')!;

/** @type {HTMLTextAreaElement | null} */
const textareaEl: HTMLTextAreaElement = document.querySelector('textarea')!;

/** @type {HTMLElement | null} */
const terminalEl: HTMLElement = document.querySelector('.terminal')!;


/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance: WebContainer;

window.addEventListener('load', async () => {
  textareaEl.value = files['index.js'].file.contents;

  textareaEl.addEventListener('input', (e: Event) => {
    writeIndexJS(e.currentTarget?.value);
  });

  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.open(terminalEl);

  // Call only once
  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(files);

  const exitCode = await installDependencies(terminal);
  if (exitCode !== 0) {
    throw new Error('Failed to install dependencies');
  }
  // Wait for `server-ready` event
  webcontainerInstance.on('server-ready', (port, url) => {
    iframeEl.src = url;
  });

  await startShell(terminal);


});


async function installDependencies(terminal: Terminal) {
  const installProcess = await webcontainerInstance.spawn('npm', ['install']);

  installProcess.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data)
    },
  }));

  return installProcess.exit;
}

/** @param {string} content*/
async function writeIndexJS(content: string) {
  await webcontainerInstance.fs.writeFile('/index.js', content);
};


/**
 * @param {Terminal} terminal
 */
async function startShell(terminal: Terminal) {
  const shellProcess = await webcontainerInstance.spawn('jsh');
  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  const input = shellProcess.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });
  return shellProcess;
};
