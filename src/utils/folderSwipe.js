function isFolderSwipe(gesture) {
  return (
    gesture.numberActiveTouches <= 1 &&
    Math.abs(gesture.dx) > 18 &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8
  );
}

function swipedFolder(folderIds, selectedId, gesture) {
  if (
    Math.abs(gesture.dx) < 55 ||
    Math.abs(gesture.dx) <= Math.abs(gesture.dy) * 1.8
  )
    return selectedId;
  const index = folderIds.indexOf(selectedId);
  if (index < 0) return selectedId;
  const target = index + (gesture.dx < 0 ? 1 : -1);
  return folderIds[Math.max(0, Math.min(folderIds.length - 1, target))];
}

module.exports = { isFolderSwipe, swipedFolder };
