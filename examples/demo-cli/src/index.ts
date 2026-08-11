#!/usr/bin/env node

import { createInterface } from 'node:readline';

const prompt = 'termwright> ';
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt,
});

console.log('Termwright demo CLI');
console.log('Type help for commands.');
terminal.prompt();

terminal.on('line', (line) => {
  const [command = '', ...args] = line.trim().split(/\s+/);
  switch (command) {
    case '':
      break;
    case 'help':
      console.log('Commands: help, echo <text>, color, clear, exit');
      break;
    case 'echo':
      console.log(args.join(' '));
      break;
    case 'color':
      console.log('\u001b[32mgreen\u001b[0m \u001b[33mamber\u001b[0m \u001b[31mred\u001b[0m');
      break;
    case 'clear':
      process.stdout.write('\u001b[2J\u001b[H');
      break;
    case 'exit':
      console.log('bye');
      terminal.close();
      return;
    default:
      console.log(`Unknown command: ${command}`);
  }
  terminal.prompt();
});

terminal.on('close', () => {
  process.exitCode = 0;
});
