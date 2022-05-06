/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $deleteTableColumn,
  $getElementGridForTableNode,
  $getTableCellNodeFromLexicalNode,
  $getTableCellSiblingsFromTableCellNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn,
  $insertTableRow,
  $isTableCellNode,
  $isTableRowNode,
  $removeTableRowAtIndex,
  getTableSelectionFromTableElement,
  TableCellHeaderStates,
  TableCellNode,
} from '@lexical/table';
import {
  $getSelection,
  $isGridSelection,
  $isRangeSelection,
  $setSelection,
} from 'lexical';
import * as React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
// $FlowFixMe
import {createPortal} from 'react-dom';

import TextInput from '../ui/TextInput';

type TableCellActionMenuProps = $ReadOnly<{
  contextRef: {current: null | HTMLElement},
  onClose: () => void,
  setIsMenuOpen: (boolean) => void,
  tableCellNode: TableCellNode,
}>;

function TableActionMenu({
  onClose,
  tableCellNode: _tableCellNode,
  setIsMenuOpen,
  contextRef,
}: TableCellActionMenuProps) {
  const [editor] = useLexicalComposerContext();
  const dropDownRef = useRef();
  const [tableCellNode, updateTableCellNode] = useState(_tableCellNode);
  const [selectionCounts, updateSelectionCounts] = useState({
    columns: 1,
    rows: 1,
  });

  useEffect(() => {
    return editor.registerMutationListener(TableCellNode, (nodeMutations) => {
      const nodeUpdated =
        nodeMutations.get(tableCellNode.getKey()) === 'updated';

      if (nodeUpdated) {
        editor.getEditorState().read(() => {
          updateTableCellNode(tableCellNode.getLatest());
        });
      }
    });
  }, [editor, tableCellNode]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();

      if ($isGridSelection(selection)) {
        const selectionShape = selection.getShape();

        updateSelectionCounts({
          columns: selectionShape.toX - selectionShape.fromX + 1,
          rows: selectionShape.toY - selectionShape.fromY + 1,
        });
      }
    });
  }, [editor]);

  useEffect(() => {
    const menuButtonElement = contextRef.current;
    const dropDownElement = dropDownRef.current;

    if (menuButtonElement != null && dropDownElement != null) {
      const menuButtonRect = menuButtonElement.getBoundingClientRect();

      dropDownElement.style.opacity = '1';

      dropDownElement.style.left = `${
        menuButtonRect.left + menuButtonRect.width + window.pageXOffset + 5
      }px`;

      dropDownElement.style.top = `${
        menuButtonRect.top + window.pageYOffset
      }px`;
    }
  }, [contextRef, dropDownRef]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropDownRef.current != null &&
        contextRef.current != null &&
        !dropDownRef.current.contains(event.target) &&
        !contextRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('click', handleClickOutside);

    return () => window.removeEventListener('click', handleClickOutside);
  }, [setIsMenuOpen, contextRef]);

  const clearTableSelection = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        const tableElement = editor.getElementByKey(tableNode.getKey());

        if (!tableElement) {
          throw new Error('Expected to find tableElement in DOM');
        }

        const tableSelection = getTableSelectionFromTableElement(tableElement);
        tableSelection.clearHighlight();

        tableNode.markDirty();
        updateTableCellNode(tableCellNode.getLatest());
      }

      $setSelection(null);
    });
  }, [editor, tableCellNode]);

  const insertTableRowAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.update(() => {
        const selection = $getSelection();

        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        let tableRowIndex;

        if ($isGridSelection(selection)) {
          const selectionShape = selection.getShape();
          tableRowIndex = shouldInsertAfter
            ? selectionShape.toY
            : selectionShape.fromY;
        } else {
          tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
        }

        const grid = $getElementGridForTableNode(editor, tableNode);

        $insertTableRow(
          tableNode,
          tableRowIndex,
          shouldInsertAfter,
          selectionCounts.rows,
          grid,
        );

        clearTableSelection();

        onClose();
      });
    },
    [editor, tableCellNode, selectionCounts.rows, clearTableSelection, onClose],
  );

  const insertTableColumnAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.update(() => {
        const selection = $getSelection();

        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        let tableColumnIndex;

        if ($isGridSelection(selection)) {
          const selectionShape = selection.getShape();
          tableColumnIndex = shouldInsertAfter
            ? selectionShape.toX
            : selectionShape.fromX;
        } else {
          tableColumnIndex =
            $getTableColumnIndexFromTableCellNode(tableCellNode);
        }

        $insertTableColumn(
          tableNode,
          tableColumnIndex,
          shouldInsertAfter,
          selectionCounts.columns,
        );

        clearTableSelection();

        onClose();
      });
    },
    [
      editor,
      tableCellNode,
      selectionCounts.columns,
      clearTableSelection,
      onClose,
    ],
  );

  const deleteTableRowAtSelection = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);

      $removeTableRowAtIndex(tableNode, tableRowIndex);

      clearTableSelection();
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const deleteTableAtSelection = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      tableNode.remove();

      clearTableSelection();
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const deleteTableColumnAtSelection = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

      const tableColumnIndex =
        $getTableColumnIndexFromTableCellNode(tableCellNode);

      $deleteTableColumn(tableNode, tableColumnIndex);

      clearTableSelection();
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const toggleTableRowIsHeader = useCallback(
    (isHeader) => {
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);

        const tableRows = tableNode.getChildren();

        if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
          throw new Error('Expected table cell to be inside of table row.');
        }

        const tableRow = tableRows[tableRowIndex];

        if (!$isTableRowNode(tableRow)) {
          throw new Error('Expected table row');
        }

        tableRow.getChildren().forEach((tableCell) => {
          if (!$isTableCellNode(tableCell)) {
            throw new Error('Expected table cell');
          }

          tableCell.toggleHeaderStyle(TableCellHeaderStates.ROW);
        });

        clearTableSelection();
        onClose();
      });
    },
    [editor, tableCellNode, clearTableSelection, onClose],
  );

  const toggleTableColumnIsHeader = useCallback(
    (isHeader) => {
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        const tableColumnIndex =
          $getTableColumnIndexFromTableCellNode(tableCellNode);

        const tableRows = tableNode.getChildren();

        for (let r = 0; r < tableRows.length; r++) {
          const tableRow = tableRows[r];

          if (!$isTableRowNode(tableRow)) {
            throw new Error('Expected table row');
          }

          const tableCells = tableRow.getChildren();

          if (tableColumnIndex >= tableCells.length || tableColumnIndex < 0) {
            throw new Error('Expected table cell to be inside of table row.');
          }

          const tableCell = tableCells[tableColumnIndex];

          if (!$isTableCellNode(tableCell)) {
            throw new Error('Expected table cell');
          }

          tableCell.toggleHeaderStyle(TableCellHeaderStates.COLUMN);
        }

        clearTableSelection();
        onClose();
      });
    },
    [editor, tableCellNode, clearTableSelection, onClose],
  );

  const mergeRightCell = useCallback(() => {
    editor.update(() => {
      console.log(tableCellNode);
      // const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      // console.log(tableNode);
      // const grid = $getElementGridForTableNode(editor, tableNode);
      // const getCellSiblings = $getTableCellSiblingsFromTableCellNode(
      //   tableCellNode,
      //   grid,
      // );

      // const {above, below, left, right} = getCellSiblings;
      // console.log({above, below, left, right});
      //       $getTableColumnIndexFromTableCellNode(tableCellNode);

      const elemKey = editor.getElementByKey(tableCellNode.getKey());
      elemKey.setAttribute('colspan', '2');
      clearTableSelection();
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const styleCellOptions = useCallback(
    (
      cellStyle,
      cellBackgroundColor,
      topBorderCellStyle,
      bottomBorderCellStyle,
      rightBorderCellStyle,
      leftBorderCellStyle,
    ) => {
      editor.update(() => {
        console.log(leftBorderCellStyle);
        const elemKey = editor.getElementByKey(tableCellNode.getKey());

        if (topBorderCellStyle) {
          elemKey.style.borderTop = `${topBorderCellStyle}`;
          elemKey.style.borderRadius = '10px';
        }
        if (bottomBorderCellStyle) {
          elemKey.style.borderBottom = `${bottomBorderCellStyle}`;
        }
        if (rightBorderCellStyle) {
          elemKey.style.borderRight = `${rightBorderCellStyle}`;
        }
        if (leftBorderCellStyle) {
          elemKey.style.borderLeft = `${leftBorderCellStyle}`;
        }

        // const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        // console.log(tableNode);
        // const grid = $getElementGridForTableNode(editor, tableNode);
        // const getCellSiblings = $getTableCellSiblingsFromTableCellNode(
        //   tableCellNode,
        //   grid,
        // );

        // const {above, below, left, right} = getCellSiblings;
        // console.log({above, below, left, right});
        //       $getTableColumnIndexFromTableCellNode(tableCellNode);

        // console.log(elemKey);
        // // elemKey.setAttribute('colspan', '2');
        // elemKey.style.background = 'red';
        // elemKey.style.border = `${cellStyle}`;
        clearTableSelection();
        onClose();
      });
    },
    [editor, tableCellNode, clearTableSelection, onClose],
  );

  // const mergeRightCell = useCallback(() => {
  //   editor.update(() => {
  //     const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
  //     const tableColumnIndex =
  //       $getTableColumnIndexFromTableCellNode(tableCellNode);
  //     // const tableRowNodeIndex =
  //     //   $getTableRowNodeFromTableCellNodeOrThrow(tableCellNode);

  //     console.log(tableColumnIndex);
  //     const tableRows = tableNode.getChildren();
  //     for (let r = 0; r < tableRows.length; r++) {
  //       const tableRow = tableRows[r];

  //       if (!$isTableRowNode(tableRow)) {
  //         throw new Error('Expected table row');
  //       }

  //       const tableCells = tableRow.getChildren();

  //       if (tableColumnIndex >= tableCells.length || tableColumnIndex < 0) {
  //         throw new Error('Expected table cell to be inside of table row.');
  //       }

  //       const tableCell = tableCells[tableColumnIndex];

  //       if (!$isTableCellNode(tableCell)) {
  //         throw new Error('Expected table cell');
  //       }
  //       tableCell.mergeCellRight('2');
  //     }
  //     $deleteTableColumn(tableNode, tableColumnIndex);

  //     clearTableSelection();
  //     onClose();
  //   });
  // }, [editor, tableCellNode, clearTableSelection, onClose]);

  // const [headerBackgroundColor, setHeaderBackgroundColor] = useState('gray');
  const [cellBackgroundColor, setCellBackgroundColor] = useState('white');
  const [cellBorderColor, setCellBorderColor] = useState('black');
  const [cellBorderStyle, setCellBorderStyle] = useState('solid');
  const [cellBorderWidth, setCellBorderWidth] = useState('1');

  const [cellBorderTopColor, setCellBorderTopColor] = useState('');
  const [cellBorderTopStyle, setCellBorderTopStyle] = useState('');
  const [cellBorderTopWidth, setCellBorderTopWidth] = useState('');

  const [cellBorderBottomColor, setCellBorderBottomColor] = useState('');
  const [cellBorderBottomStyle, setCellBorderBottomStyle] = useState('');
  const [cellBorderBottomWidth, setCellBorderBottomWidth] = useState('');

  const [cellBorderLeftColor, setCellBorderLeftColor] = useState('');
  const [cellBorderLeftStyle, setCellBorderLeftStyle] = useState('');
  const [cellBorderLeftWidth, setCellBorderLeftWidth] = useState('');

  const [cellBorderRightColor, setCellBorderRightColor] = useState('');
  const [cellBorderRightStyle, setCellBorderRightStyle] = useState('');
  const [cellBorderRightWidth, setCellBorderRightWidth] = useState('');

  const [cellStyle, setCellStyle] = useState('');
  const [topBorderCellStyle, setTopBorderCellStyle] = useState('');
  const [bottomBorderCellStyle, setBottomBorderCellStyle] = useState('');
  const [leftBorderCellStyle, setLeftBorderCellStyle] = useState('');
  const [rightBorderCellStyle, setRightBorderCellStyle] = useState('');

  useEffect(() => {
    setCellStyle(`${cellBorderWidth}px ${cellBorderStyle} ${cellBorderColor}`);
  }, [cellBorderWidth, cellBorderStyle, cellBorderColor]);

  useEffect(() => {
    setTopBorderCellStyle(
      `${cellBorderTopWidth}px ${cellBorderTopStyle} ${cellBorderTopColor}`,
    );
  }, [cellBorderTopWidth, cellBorderTopStyle, cellBorderTopColor]);

  useEffect(() => {
    setBottomBorderCellStyle(
      `${cellBorderBottomWidth}px ${cellBorderBottomStyle} ${cellBorderBottomColor}`,
    );
  }, [cellBorderBottomWidth, cellBorderBottomStyle, cellBorderBottomColor]);

  useEffect(() => {
    setRightBorderCellStyle(
      `${cellBorderRightWidth}px ${cellBorderRightStyle} ${cellBorderRightColor}`,
    );
  }, [cellBorderRightWidth, cellBorderRightStyle, cellBorderRightColor]);

  useEffect(() => {
    setLeftBorderCellStyle(
      `${cellBorderLeftWidth}px ${cellBorderLeftStyle} ${cellBorderLeftColor}`,
    );
  }, [cellBorderLeftWidth, cellBorderLeftStyle, cellBorderLeftColor]);

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="dropdown"
      ref={dropDownRef}
      onClick={(e) => {
        e.stopPropagation();
      }}>
      <button className="item" onClick={() => insertTableRowAtSelection(false)}>
        <span className="text">
          Insert{' '}
          {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
          above
        </span>
      </button>
      <button className="item" onClick={() => insertTableRowAtSelection(true)}>
        <span className="text">
          Insert{' '}
          {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
          below
        </span>
      </button>
      <hr />
      <button className="item" onClick={() => mergeRightCell(true)}>
        <span className="text">
          MergeCell right avec des bordures JAUNES DOTTES DE 3 px et un fond
          rouge
        </span>
      </button>
      <hr />
      <div>
        <TextInput
          label="Background Color"
          onChange={setCellBackgroundColor}
          value={cellBackgroundColor}
        />
        <TextInput
          label="Border Color"
          onChange={setCellBorderColor}
          value={cellBorderColor}
        />
        <TextInput
          label="Border thickness"
          onChange={setCellBorderWidth}
          value={cellBorderWidth}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}>
          <p>Border Style</p>
          <select
            id="Border Style"
            name="Border Style"
            style={{align: 'center', height: '50%', width: '50%'}}
            value={cellBorderStyle}
            onChange={(e) => setCellBorderStyle(e.target.value)}>
            <option value="none">none</option>
            <option value="dotted">dotted</option>
            <option value="inset">inset</option>
            <option value="solid">solid</option>
            <option value="double">double</option>
            <option value="groove">groove</option>
            <option value="ridge">ridge</option>
            <option value="outset">outset</option>
            <option value="mix">mix</option>
          </select>
        </div>
        <hr />
        <TextInput
          label="Border Top Color"
          onChange={setCellBorderTopColor}
          value={cellBorderTopColor}
        />
        <TextInput
          label="Border top width"
          onChange={setCellBorderTopWidth}
          value={cellBorderTopWidth}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}>
          <p>Border Top Style</p>
          <select
            id="Border Top Style"
            name="Border Top Style"
            style={{align: 'center', height: '50%', width: '50%'}}
            value={cellBorderTopStyle}
            onChange={(e) => setCellBorderTopStyle(e.target.value)}>
            <option value="none">none</option>
            <option value="dotted">dotted</option>
            <option value="inset">inset</option>
            <option value="solid">solid</option>
            <option value="double">double</option>
            <option value="groove">groove</option>
            <option value="ridge">ridge</option>
            <option value="outset">outset</option>
            <option value="mix">mix</option>
          </select>
        </div>
        <hr />
        <TextInput
          label="Border bottom Color"
          onChange={setCellBorderBottomColor}
          value={cellBorderBottomColor}
        />
        <TextInput
          label="Border bottom width"
          onChange={setCellBorderBottomWidth}
          value={cellBorderBottomWidth}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}>
          <p>Border Bottom Style</p>
          <select
            id="Border bottom Style"
            name="Border bottom Style"
            style={{align: 'center', height: '50%', width: '50%'}}
            value={cellBorderBottomStyle}
            onChange={(e) => setCellBorderBottomStyle(e.target.value)}>
            <option value="none">none</option>
            <option value="dotted">dotted</option>
            <option value="inset">inset</option>
            <option value="solid">solid</option>
            <option value="double">double</option>
            <option value="groove">groove</option>
            <option value="ridge">ridge</option>
            <option value="outset">outset</option>
            <option value="mix">mix</option>
          </select>
        </div>
        <hr />
        <TextInput
          label="Border right Color"
          onChange={setCellBorderRightColor}
          value={cellBorderRightColor}
        />
        <TextInput
          label="Border right width"
          onChange={setCellBorderRightWidth}
          value={cellBorderRightWidth}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}>
          <p>Border Right Style</p>
          <select
            id="Border right Style"
            name="Border right Style"
            style={{align: 'center', height: '50%', width: '50%'}}
            value={cellBorderRightStyle}
            onChange={(e) => setCellBorderRightStyle(e.target.value)}>
            <option value="none">none</option>
            <option value="dotted">dotted</option>
            <option value="inset">inset</option>
            <option value="solid">solid</option>
            <option value="double">double</option>
            <option value="groove">groove</option>
            <option value="ridge">ridge</option>
            <option value="outset">outset</option>
            <option value="mix">mix</option>
          </select>
        </div>
        <hr />
        <TextInput
          label="Border left Color"
          onChange={setCellBorderLeftColor}
          value={cellBorderLeftColor}
        />
        <TextInput
          label="Border left width"
          onChange={setCellBorderLeftWidth}
          value={cellBorderLeftWidth}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
          }}>
          <p>Border Left Style</p>
          <select
            id="Border left Style"
            name="Border left Style"
            style={{align: 'center', height: '50%', width: '50%'}}
            value={cellBorderLeftStyle}
            onChange={(e) => setCellBorderLeftStyle(e.target.value)}>
            <option value="none">none</option>
            <option value="dotted">dotted</option>
            <option value="inset">inset</option>
            <option value="solid">solid</option>
            <option value="double">double</option>
            <option value="groove">groove</option>
            <option value="ridge">ridge</option>
            <option value="outset">outset</option>
            <option value="mix">mix</option>
          </select>
        </div>

        <button
          className="item"
          onClick={() =>
            styleCellOptions(
              cellStyle,
              cellBackgroundColor,
              topBorderCellStyle,
              bottomBorderCellStyle,
              rightBorderCellStyle,
              leftBorderCellStyle,
            )
          }>
          <span className="text">Set cell option</span>
        </button>
      </div>
      <hr />
      <button
        className="item"
        onClick={() => insertTableColumnAtSelection(false)}>
        <span className="text">
          Insert{' '}
          {selectionCounts.columns === 1
            ? 'column'
            : `${selectionCounts.columns} columns`}{' '}
          left
        </span>
      </button>
      <button
        className="item"
        onClick={() => insertTableColumnAtSelection(true)}>
        <span className="text">
          Insert{' '}
          {selectionCounts.columns === 1
            ? 'column'
            : `${selectionCounts.columns} columns`}{' '}
          right
        </span>
      </button>
      <hr />
      <button className="item" onClick={() => deleteTableColumnAtSelection()}>
        <span className="text">Delete column</span>
      </button>
      <button className="item" onClick={() => deleteTableRowAtSelection()}>
        <span className="text">Delete row</span>
      </button>
      <button className="item" onClick={() => deleteTableAtSelection()}>
        <span className="text">Delete table</span>
      </button>
      <hr />
      {/* <input
         value={headerBackgroundColor}
         onChange={(e) => setHeaderBackgroundColor(e.target.value)}
       /> */}
      <button className="item" onClick={() => toggleTableRowIsHeader()}>
        <span className="text">
          {(tableCellNode.__headerState & TableCellHeaderStates.ROW) ===
          TableCellHeaderStates.ROW
            ? 'Remove'
            : 'Add'}{' '}
          row header
        </span>
      </button>
      <button className="item" onClick={() => toggleTableColumnIsHeader()}>
        <span className="text">
          {(tableCellNode.__headerState & TableCellHeaderStates.COLUMN) ===
          TableCellHeaderStates.COLUMN
            ? 'Remove'
            : 'Add'}{' '}
          column header
        </span>
      </button>
    </div>,
    document.body,
  );
}

function TableCellActionMenuContainer(): React.MixedElement {
  const [editor] = useLexicalComposerContext();

  const menuButtonRef = useRef(null);
  const menuRootRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [tableCellNode, setTableMenuCellNode] = useState<TableCellNode | null>(
    null,
  );

  const moveMenu = useCallback(() => {
    const menu = menuButtonRef.current;
    const selection = $getSelection();
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (selection == null || menu == null) {
      setTableMenuCellNode(null);
      return;
    }

    const rootElement = editor.getRootElement();

    if (
      $isRangeSelection(selection) &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const tableCellNodeFromSelection = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode(),
      );

      if (tableCellNodeFromSelection == null) {
        setTableMenuCellNode(null);
        return;
      }

      const tableCellParentNodeDOM = editor.getElementByKey(
        tableCellNodeFromSelection.getKey(),
      );

      if (tableCellParentNodeDOM == null) {
        setTableMenuCellNode(null);
        return;
      }

      setTableMenuCellNode(tableCellNodeFromSelection);
    } else if (!activeElement) {
      setTableMenuCellNode(null);
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        moveMenu();
      });
    });
  });

  useEffect(() => {
    const menuButtonDOM = menuButtonRef.current;

    if (menuButtonDOM != null && tableCellNode != null) {
      const tableCellNodeDOM = editor.getElementByKey(tableCellNode.getKey());

      if (tableCellNodeDOM != null) {
        const tableCellRect = tableCellNodeDOM.getBoundingClientRect();
        const menuRect = menuButtonDOM.getBoundingClientRect();

        menuButtonDOM.style.opacity = '1';

        menuButtonDOM.style.left = `${
          tableCellRect.left +
          window.pageXOffset -
          menuRect.width +
          tableCellRect.width -
          10
        }px`;

        menuButtonDOM.style.top = `${
          tableCellRect.top + window.pageYOffset + 5
        }px`;
      } else {
        menuButtonDOM.style.opacity = '0';
      }
    }
  }, [menuButtonRef, tableCellNode, editor]);

  const prevTableCellDOM = useRef(tableCellNode);

  useEffect(() => {
    if (prevTableCellDOM.current !== tableCellNode) {
      setIsMenuOpen(false);
    }

    prevTableCellDOM.current = tableCellNode;
  }, [prevTableCellDOM, tableCellNode]);

  return (
    <div className="table-cell-action-button-container" ref={menuButtonRef}>
      {tableCellNode != null && (
        <>
          <button
            className="table-cell-action-button chevron-down"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            ref={menuRootRef}>
            <i className="chevron-down" />
          </button>
          {isMenuOpen && (
            <TableActionMenu
              contextRef={menuRootRef}
              setIsMenuOpen={setIsMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              tableCellNode={tableCellNode}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function TableActionMenuPlugin(): React.Portal {
  const [editor] = useLexicalComposerContext();

  return useMemo(
    () =>
      createPortal(
        <TableCellActionMenuContainer editor={editor} />,
        document.body,
      ),
    [editor],
  );
}
