// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
const COMMAND = 'php-variables-refactor.refactorVariable';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      'php',
      new VariableRefactor(),
      {
        providedCodeActionKinds: VariableRefactor.providedCodeActionKinds,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND, async function () {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const document = editor.document;
        let selection = editor.selection;

        const variableValues = await getVariableValues(document, selection);
        if (!variableValues.name) {
          return;
        }

        const { currentFirstPosition, aboveLastPosition, currentLine } =
          await getLinesInformation(document, selection);

        await editor.edit((editBuilder) => {
          editBuilder.insert(aboveLastPosition, '\n');
        });

        // refreshing selection is needed to prevent bugs
        selection = editor.selection;
        await editor.edit((editBuilder) => {
          editBuilder.insert(
            currentFirstPosition,
            ' '.repeat(currentLine.firstNonWhitespaceCharacterIndex)
          );

          editBuilder.insert(
            currentFirstPosition,
            `\$${variableValues.name} = ${variableValues.value};`
          );

          editBuilder.replace(selection, `\$${variableValues.name}`);
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

async function getLinesInformation(
  document: vscode.TextDocument,
  selection: vscode.Selection
): Promise<{
  currentFirstPosition: vscode.Position;
  aboveLastPosition: vscode.Position;
  currentLine: vscode.TextLine;
}> {
  const currentLine = document.lineAt(selection.anchor.line);
  const currentFirstPosition = new vscode.Position(
    currentLine.lineNumber,
    currentLine.firstNonWhitespaceCharacterIndex
  );
  const aboveLastPosition = new vscode.Position(
    currentLine.lineNumber - 1,
    document.lineAt(currentLine.lineNumber - 1).range.end.character
  );

  return {
    currentFirstPosition,
    aboveLastPosition,
    currentLine,
  };
}

function inferVariableName(value: string) {
  const defaultValue = 'variable';

  // $var->getProperty() = ['var', 'Property'];
  let matches = value.match(/\$(\w*\d*)->get_*(\w*\d*)\([^)]*\);*$/i);
  if (matches) {
    return transformVariableIntoConfigCase(matches);
  }

  // $var->property = ['var', 'Property'];
  matches = value.match(/\$(\w*\d*)->_*(\w*\d*)\;*$/i);
  if (matches) {
    return transformVariableIntoConfigCase(matches);
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
  while (variablePieces.length > 2) {
    variablePieces.shift();
  }

  if (variablePieces.length === 1) {
    return variablePieces[0];
  }

  const config: { type: string } | undefined = vscode.workspace
    .getConfiguration('phpVariablesRefactor')
    .get('naming');

  switch (config?.type) {
    default:
    case undefined:
    case 'lowerCamelCase':
      return (
        variablePieces[0].toLowerCase() +
        variablePieces[1].charAt(0).toUpperCase() +
        variablePieces[1].slice(1)
      );

    case 'CamelCase':
      return (
        variablePieces[0].charAt(0).toUpperCase() +
        variablePieces[0].slice(1) +
        variablePieces[1].charAt(0).toUpperCase() +
        variablePieces[1].slice(1)
      );

    case 'snake_case':
      return (
        variablePieces[0].toLowerCase() + '_' + variablePieces[1].toLowerCase()
      );

    case 'kebab-case':
      return (
        variablePieces[0].toLowerCase() + '-' + variablePieces[1].toLowerCase()
      );
  }
}

export class VariableRefactor implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    if (!this.isValidVariableValue(document, range)) {
      return [];
    }

    return [this.createFix('Refactor as variable')];
  }

  private isValidVariableValue(
    document: vscode.TextDocument,
    range: vscode.Range
  ): boolean {
    const selection = document.getText(
      vscode.window.activeTextEditor?.selection
    );

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
