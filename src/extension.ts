// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { workspace } from 'vscode';
const COMMAND = 'php-variables-refactor.refactorVariable';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('php', new VariableRefactor(), {
      providedCodeActionKinds: VariableRefactor.providedCodeActionKinds,
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND, async function () {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const document = editor.document;
        const selection = editor.selection;
        const workspaceConfiguration = workspace.getConfiguration('editor');

        const variableValues = await getVariableValues(document, selection);
        if (!variableValues.name) {
          return;
        }

        let currentLine = document.lineAt(selection.anchor.line);
        const lineEnding: string = workspaceConfiguration.get<string>('lineEnding') ?? '\n';

        let insertPosition = new vscode.Position(currentLine.lineNumber, 0);
        let identation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);

        while (lineEndsWithComma(currentLine.text)) {
          currentLine = document.lineAt(currentLine.lineNumber - 1);

          insertPosition = new vscode.Position(currentLine.lineNumber, 0);
          identation = currentLine.text.substring(0, currentLine.firstNonWhitespaceCharacterIndex);
        }

        await editor.edit((editBuilder) => {
          editBuilder.insert(
            insertPosition,
            identation + `\$${variableValues.name} = ${variableValues.value};` + lineEnding
          );

          for (const selection of editor.selections) {
            editBuilder.replace(selection, `\$${variableValues.name}`);
          }
        });
      }
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function getVariableValues(
  document: vscode.TextDocument,
  selection: vscode.Selection
): Promise<{ value: string; name: string | undefined }> {
  const varValue = document.getText(selection);
  const possibleVarName = inferVariableName(varValue);

  const varName = await vscode.window.showInputBox({
    placeHolder: possibleVarName,
    value: possibleVarName,
  });

  return {
    value: varValue,
    name: varName,
  };
}

function lineEndsWithComma(line: string): boolean {
  return line.replace(/[\s\t\n]+$/, '').endsWith(',');
}

function inferVariableName(value: string): string {
  const defaultValue = 'variable';

  // $var->getProperty() = ['var', 'Property'];
  let matches = value.match(/\$(\w*\d*)->get_*(\w*\d*)\([^)]*\);*$/i);
  if (matches) {
    return transformVariableIntoConfigCase(matches.slice(1));
  }

  // $var->property = ['var', 'Property'];
  matches = value.match(/\$(\w*\d*)->_*(\w*\d*)\;*$/i);
  if (matches) {
    return transformVariableIntoConfigCase(matches.slice(1));
  }

  // $var->getProperty1()->getProperty2() = ['Property1', 'Property2'];
  const result = [];
  const regex = /get(\w*\d*)\([^)]*\)/g;
  matches = regex.exec(value);
  while (matches !== null) {
    result.push(matches[1]);
    matches = regex.exec(value);
  }
  if (result.length) {
    return transformVariableIntoConfigCase(result);
  }

  return defaultValue;
}

function transformVariableIntoConfigCase(variablePieces: string[]): string {
  if (variablePieces.length === 1) {
    return variablePieces[0];
  }

  const config = vscode.workspace.getConfiguration('phpVariablesRefactor');

  const variablesQuantity = config.get('naming.variablesQuantity') ?? 2;
  variablePieces = variablePieces.slice((variablesQuantity as number) * -1);

  const namingType = config.get('naming.type');
  switch (namingType) {
    default:
    case undefined:
    case 'lowerCamelCase':
      return variablePieces
        .map((piece, index) => {
          return index === 0 ? piece.toLowerCase() : piece.charAt(0).toUpperCase() + piece.slice(1);
        })
        .join('');

    case 'CamelCase':
      return variablePieces.map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1)).join('');

    case 'snake_case':
      return variablePieces.map((piece) => piece.toLowerCase()).join('_');

    case 'kebab-case':
      return variablePieces.map((piece) => piece.toLowerCase()).join('-');
  }
}

export class VariableRefactor implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    if (!this.isValidVariableValue(document, range)) {
      return [];
    }

    return [this.createFix('Refactor as variable')];
  }

  private isValidVariableValue(document: vscode.TextDocument, range: vscode.Range): boolean {
    const selection = document.getText(vscode.window.activeTextEditor?.selection);

    if (!selection) {
      return false;
    }

    if (range.isEmpty) {
      return false;
    }

    if (selection.includes('=')) {
      return false;
    }

    if (selection.length === 1 && isNaN(parseInt(selection))) {
      return false;
    }

    return true;
  }

  private createFix(title: string): vscode.CodeAction {
    const fix = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    fix.command = {
      title,
      command: COMMAND,
    };

    return fix;
  }
}
