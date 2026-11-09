import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
	test('registers Docster commands', async () => {
		await vscode.extensions.getExtension('RajanPoudel.docster')?.activate();
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('docster.addComment'));
		assert.ok(commands.includes('docster.generateDocs'));
		assert.ok(commands.includes('docster.generateProjectDocs'));
	});
});