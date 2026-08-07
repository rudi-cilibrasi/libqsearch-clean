/**
 * Serialize a distance matrix for the native QSearch parser.
 *
 * Leaf identifiers are positional and collision-free. The worker restores the
 * original display labels by leaf index after every native run, so punctuation,
 * Unicode, and two labels with the same sanitized form cannot alter topology.
 */
export const getTreeInput = (input: {labels: string[]; ncdMatrix: number[][]}): string => {
  const {labels, ncdMatrix} = input;
  if (!labels.length || !ncdMatrix.length) return "";
  if (ncdMatrix.length !== labels.length) {
    throw new Error("Cannot serialize a matrix whose dimensions do not match its labels");
  }

  return ncdMatrix.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== labels.length) {
      throw new Error(`Cannot serialize matrix row ${rowIndex}`);
    }
    const values = row.map((value, columnIndex) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Cannot serialize invalid matrix value at [${rowIndex}][${columnIndex}]`);
      }
      // Number#toString is the shortest decimal that round-trips to the same
      // IEEE-754 double, unlike the former fixed six-decimal representation.
      return value.toString();
    });
    return `leaf_${rowIndex} ${values.join(" ")}`;
  }).join("\n") + "\n";
};
