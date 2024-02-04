import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('It infers values from properties', () => {
    const regex = /\$(\w*\d*)->_*(\w*\d*)\;*$/i;

    const testCases: Record<string, string[]> = {
      '$something->property': ['something', 'property'],
      '$something->property;': ['something', 'property'],
      '$something->_property': ['something', 'property'],
      '$something->_property;': ['something', 'property'],
    };

    for (const variable in testCases) {
      const matches = variable.match(regex) as RegExpExecArray;
      assert.notEqual(matches, null);

      while (matches.length > 2) {
        matches.shift();
      }

      for (let i = 0; i < testCases[variable].length; i++) {
        const expectedMatch = testCases[variable][i];
        assert.strictEqual(matches[i], expectedMatch);
      }
    }
  });

  test('It infers values from simple function chaining', () => {
    const regex = /\$(\w*\d*)->get_*(\w*\d*)\([^)]*\);*$/i;

    const testCases: Record<string, string[]> = {
      '$something->getProperty()': ['something', 'Property'],
      '$something->getProperty();': ['something', 'Property'],
      '$something->get_property();': ['something', 'property'],
      '$something->get_property(123123);': ['something', 'property'],
    };

    for (const variable in testCases) {
      const matches = variable.match(regex) as RegExpExecArray;
      assert.notEqual(matches, null);

      while (matches.length > 2) {
        matches.shift();
      }

      for (let i = 0; i < testCases[variable].length; i++) {
        const expectedMatch = testCases[variable][i];
        assert.strictEqual(matches[i], expectedMatch);
      }
    }
  });

  test('It infers values from complex function chaining', () => {
    const regex = /get(\w*\d*)\([^)]*\)/g;

    const testCases: Record<string, string[]> = {
      '$something->getProperty()->getId();': ['Property', 'Id'],
      '$something->getProperty2()->getId();': ['Property2', 'Id'],
      '$something->get2("something")->getId(\'text\')->getAnotherProperty($a->b->c())->callSomething->getB(["asd",321,\'text\']);':
        ['AnotherProperty', 'B'],
    };

    for (const variable in testCases) {
      const result: string[] = [];

      let match = regex.exec(variable);
      while (match !== null) {
        result.push(match[1]);
        match = regex.exec(variable);
      }

      assert.notEqual(result.length, 0);

      while (result.length > 2) {
        result.shift();
      }

      for (let i = 0; i < testCases[variable].length; i++) {
        const expectedMatch = testCases[variable][i];
        assert.strictEqual(result[i], expectedMatch);
      }
    }
  });

  test('It parses variables naming correctly', () => {
    const testCases: { pieces: string[]; casing: string; result: string }[] = [
      {
        pieces: ['order', 'products'],
        casing: 'CamelCase',
        result: 'OrderProducts',
      },
      {
        pieces: ['order', 'products'],
        casing: 'lowerCamelCase',
        result: 'orderProducts',
      },
      {
        pieces: ['order', 'Products'],
        casing: 'snake_case',
        result: 'order_products',
      },
      {
        pieces: ['Order', 'products'],
        casing: 'kebab-case',
        result: 'order-products',
      },
      {
        pieces: ['order', 'productsAndTaxes'],
        casing: 'lowerCamelCase',
        result: 'orderProductsAndTaxes',
      },
    ];

    for (const testCase of testCases) {
      let result: string = '';
      switch (testCase.casing) {
        default:
        case undefined:
        case 'lowerCamelCase':
          result =
            testCase.pieces[0].toLowerCase() +
            testCase.pieces[1].charAt(0).toUpperCase() +
            testCase.pieces[1].slice(1);
          break;

        case 'CamelCase':
          result =
            testCase.pieces[0].charAt(0).toUpperCase() +
            testCase.pieces[0].slice(1) +
            testCase.pieces[1].charAt(0).toUpperCase() +
            testCase.pieces[1].slice(1);
          break;

        case 'snake_case':
          result =
            testCase.pieces[0].toLowerCase() +
            '_' +
            testCase.pieces[1].toLowerCase();
          break;

        case 'kebab-case':
          result =
            testCase.pieces[0].toLowerCase() +
            '-' +
            testCase.pieces[1].toLowerCase();
          break;
      }

      assert.equal(result, testCase.result);
    }
  });
});
