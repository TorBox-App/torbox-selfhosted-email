/**
 * Find the React Flow edge element at a given screen coordinate.
 * Uses document.elementsFromPoint() to hit-test against the invisible
 * interaction path that React Flow renders when interactionWidth > 0.
 *
 * Returns the edge ID if found, null otherwise.
 */
export function findEdgeAtPoint(
  clientX: number,
  clientY: number
): string | null {
  const elements = document.elementsFromPoint(clientX, clientY);

  const interactionElement = elements.find((el) =>
    el.classList.contains("react-flow__edge-interaction")
  );

  if (!interactionElement) {
    return null;
  }

  // The interaction path is a child of the edge group element
  // which has the data-id attribute with the edge ID
  const edgeGroup = interactionElement.closest(".react-flow__edge");
  return edgeGroup?.getAttribute("data-id") ?? null;
}
