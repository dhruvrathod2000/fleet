import sqliteParser from "sqlite-parser";
import { intersection } from "lodash";
import { osqueryTables } from "utilities/osquery_tables";

const osqueryTablesDictionary = osqueryTables.reduce(
  (dictionary, osqueryTable) => {
    dictionary[osqueryTable.name] = osqueryTable.platforms;
    return dictionary;
  },
  {}
);

// The isNode and visit functionality is informed by https://lihautan.com/manipulating-ast-with-javascript/#traversing-an-ast
const isNode = (node) => {
  // TODO: Improve type checking against shape of AST generated by sqliteParser
  return typeof node === "object";
};
const visit = (abstractSyntaxTree, callbackAction) => {
  if (abstractSyntaxTree) {
    callbackAction(abstractSyntaxTree);

    Object.keys(abstractSyntaxTree).forEach((key) => {
      const childNode = abstractSyntaxTree[key];
      if (Array.isArray(childNode)) {
        childNode.forEach((grandchildNode) =>
          visit(grandchildNode, callbackAction)
        );
      } else if (isNode(childNode)) {
        visit(childNode, callbackAction);
      }
    });
  }
};

export const listCompatiblePlatforms = (tablesList) => {
  if (tablesList[0] === "Invalid query") {
    return tablesList;
  }
  const compatiblePlatforms = intersection(
    ...tablesList?.map((tableName) => osqueryTablesDictionary[tableName])
  );
  // console.log("compatiblePlatforms: ", compatiblePlatforms);
  return compatiblePlatforms.length ? compatiblePlatforms : ["None"];
};

export const parseSqlTables = (sqlString) => {
  const tablesList = [];
  try {
    const sqlTree = sqliteParser(sqlString);

    visit(
      sqlTree,
      (node) => node && node.variant === "table" && tablesList.push(node.name)
    );
    // console.log("AST: ", sqlTree);
    // console.log("tableList: ", tablesList);

    return tablesList;
  } catch (err) {
    console.log(err);

    return ["Invalid query"];
    // return null;
  }
};

export default { listCompatiblePlatforms, parseSqlTables };
