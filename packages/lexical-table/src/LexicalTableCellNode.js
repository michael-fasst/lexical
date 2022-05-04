/* eslint-disable sort-keys-fix/sort-keys-fix */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from 'lexical';

import {addClassNamesToElement} from '@lexical/utils';
import {
  $createParagraphNode,
  $isElementNode,
  $isLineBreakNode,
  GridCellNode,
} from 'lexical';

export const TableCellHeaderStates = {
  NO_STATUS: 0,
  ROW: 1,
  COLUMN: 2,
  BOTH: 3,
};

export type TableCellHeaderState = $Values<typeof TableCellHeaderStates>;

export class TableCellNode extends GridCellNode {
  __headerState: TableCellHeaderState;
  __width: ?number;
  __backgroundColorStyle: ?string;

  static getType(): 'tablecell' {
    return 'tablecell';
  }

  static clone(node: TableCellNode): TableCellNode {
    return new TableCellNode(
      node.__headerState,
      node.__colSpan,
      node.__width,
      node.__key,
      node.__backgroundColorStyle,
    );
  }

  static importDOM(): DOMConversionMap | null {
    return {
      td: (node: Node) => ({
        conversion: convertTableCellNodeElement,
        priority: 0,
      }),
      th: (node: Node) => ({
        conversion: convertTableCellNodeElement,
        priority: 0,
      }),
    };
  }

  constructor(
    headerState?: TableCellHeaderState = TableCellHeaderStates.NO_STATUS,
    colSpan?: number = 1,
    width?: ?number,
    backgroundColorStyle?: ?string,
    borderStyle?: ?string,
    key?: NodeKey,
  ): void {
    super(colSpan, key);
    this.__headerState = headerState;
    this.__width = width;
    this.__backgroundColorStyle = backgroundColorStyle;
    this.__borderStyle = borderStyle;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement(this.getTag());
    console.log('borderstyle test tavu', this.__borderStyle);

    if (this.__width) {
      element.style.width = `${this.__width}px`;
    }
    if (this.__bg) {
      element.style.backgroundColor = `${this.__backgroundColorStyle}`;
    }
    if (this.__borderStyle) {
      element.style.border = `${this.__borderStyle}`;
    }

    addClassNamesToElement(
      element,
      config.theme.tableCell,
      this.hasHeader() && config.theme.tableCellHeader,
    );

    return element;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    if (element) {
      const maxWidth = 700;
      const colCount = this.getParentOrThrow().getChildrenSize();
      element.style.border = '1px solid black';
      element.style.width = `${
        this.getWidth() || Math.max(90, maxWidth / colCount)
      }px`;

      element.style.verticalAlign = 'top';
      element.style.textAlign = 'start';

      if (this.hasHeader()) {
        element.style.backgroundColor = '#f2f3f5';
      }
    }

    return {
      element,
    };
  }

  getTag(): string {
    return this.hasHeader() ? 'th' : 'td';
  }

  setHeaderStyles(headerState: TableCellHeaderState): TableCellHeaderState {
    const self = this.getWritable();
    self.__headerState = headerState;
    return this.__headerState;
  }

  getHeaderStyles(): TableCellHeaderState {
    return this.getLatest().__headerState;
  }

  setWidth(width: number): ?number {
    const self = this.getWritable();
    self.__width = width;
    return this.__width;
  }
  setBg(backgroundColorStyle: string): ?string {
    const self = this.getWritable();
    self.__backgroundColorStyle = backgroundColorStyle;
    return this.backgroundColorStyle;
  }
  setBorderStyle(borderStyle: string): ?string {
    const self = this.getWritable();
    self.__borderStyle = borderStyle;
    return this.borderStyle;
  }

  getWidth(): ?number {
    return this.getLatest().__width;
  }

  toggleHeaderStyle(headerStateToToggle: TableCellHeaderState): TableCellNode {
    const self = this.getWritable();

    if ((self.__headerState & headerStateToToggle) === headerStateToToggle) {
      self.__headerState -= headerStateToToggle;
    } else {
      self.__headerState += headerStateToToggle;
    }

    self.__headerState = self.__headerState;

    return self;
  }

  hasHeaderState(headerState: TableCellHeaderState): boolean {
    return (this.getHeaderStyles() & headerState) === headerState;
  }

  hasHeader(): boolean {
    return this.getLatest().__headerState !== TableCellHeaderStates.NO_STATUS;
  }

  updateDOM(prevNode: TableCellNode): boolean {
    return (
      prevNode.__headerState !== this.__headerState ||
      prevNode.__width !== this.__width
    );
  }

  collapseAtStart(): true {
    return true;
  }

  canBeEmpty(): false {
    return false;
  }

  canIndent(): false {
    return false;
  }
}

export function convertTableCellNodeElement(
  domNode: Node,
): DOMConversionOutput {
  const nodeName = domNode.nodeName.toLowerCase();

  const tableCellNode = $createTableCellNode(
    nodeName === 'th'
      ? TableCellHeaderStates.ROW
      : TableCellHeaderStates.NO_STATUS,
  );

  return {
    node: tableCellNode,
    forChild: (lexicalNode, parentLexicalNode) => {
      if ($isTableCellNode(parentLexicalNode) && !$isElementNode(lexicalNode)) {
        const paragraphNode = $createParagraphNode();
        if (
          $isLineBreakNode(lexicalNode) &&
          lexicalNode.getTextContent() === '\n'
        ) {
          return null;
        }
        paragraphNode.append(lexicalNode);
        return paragraphNode;
      }

      return lexicalNode;
    },
  };
}

export function $createTableCellNode(
  headerState: TableCellHeaderState,
  colSpan?: number = 1,
  backgroundColorStyle?: ?string,
  borderStyle?: ?string,
  width?: ?number,
): TableCellNode {
  return new TableCellNode(
    headerState,
    colSpan,
    width,
    backgroundColorStyle,
    borderStyle,
  );
}

export function $isTableCellNode(node: ?LexicalNode): boolean %checks {
  return node instanceof TableCellNode;
}
