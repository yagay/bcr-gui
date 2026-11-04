#!/usr/bin/env node
// Angular 18 throws NG0600 when an effect directly writes to a Signal.
// This targeted guard prevents reintroducing the original regression in
// AudioPlayerComponent without changing the project's Angular version.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const path = 'src/app/components/audio-player/audio-player.component.ts';
const file = ts.createSourceFile(
  path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS,
);

let effectCount = 0;
const problems = [];

function scanEffect(node, withinUntracked = false) {
  const untrackedCall = ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === 'untracked';

  if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ['set', 'update'].includes(node.expression.name.text)
      && !withinUntracked) {
    const loc = file.getLineAndCharacterOfPosition(node.getStart(file));
    problems.push(`Direct Signal write at ${path}:${loc.line + 1}`);
  }

  ts.forEachChild(node, child => scanEffect(child, withinUntracked || untrackedCall));
}

function walk(node) {
  if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'effect') {
    effectCount += 1;
    const callback = node.arguments[0];
    if (!callback) {
      problems.push('effect() has no callback');
    } else {
      if (!callback.getText(file).includes('untracked(')) {
        problems.push('Audio player effect must isolate player-state writes with untracked()');
      }
      scanEffect(callback);
    }
    return;
  }
  ts.forEachChild(node, walk);
}

walk(file);
if (effectCount !== 1) problems.push(`Expected one player input effect, found ${effectCount}`);
if (problems.length) {
  console.error('NG0600 regression guard failed:\n' + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('NG0600 guard passed: player effect tracks input only; state writes are isolated.');
}
