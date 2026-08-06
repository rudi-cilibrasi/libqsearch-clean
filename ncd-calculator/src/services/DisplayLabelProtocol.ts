/**
 * Build the presentation-label mapping for one computation.
 *
 * Stable object identifiers are sent to compression and QSearch. Display
 * labels travel beside them and may contain spaces, Unicode, or duplicates.
 */
export const createDisplayLabelMap = (
  objectIds: readonly string[],
  displayLabels?: readonly string[],
): Map<string, string> => {
  if (displayLabels && displayLabels.length !== objectIds.length) {
    throw new Error("Display labels must match the number of object identifiers");
  }

  const mapping = new Map<string, string>();
  objectIds.forEach((rawId, index) => {
    const id = rawId.trim();
    if (!id) throw new Error(`Object identifier ${index + 1} is empty`);
    if (mapping.has(id)) throw new Error(`Object identifier "${id}" is duplicated`);

    const displayLabel = (displayLabels?.[index] ?? id).trim();
    if (!displayLabel) throw new Error(`Display label for "${id}" is empty`);
    mapping.set(id, displayLabel);
  });
  return mapping;
};

export const getDisplayLabel = (
  mapping: ReadonlyMap<string, string>,
  objectId: string,
): string => mapping.get(objectId) ?? objectId;
