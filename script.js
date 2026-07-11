const input = document.getElementById("photoInput");
const undoButton = document.getElementById("undoButton");
const resetButton = document.getElementById("resetButton");
const showNamesToggle = document.getElementById("showNamesToggle");
const uploadPanel = document.getElementById("uploadPanel");
const comparePanel = document.getElementById("comparePanel");
const roundProgress = document.getElementById("roundProgress");
const donePanel = document.getElementById("donePanel");
const rankingPanel = document.getElementById("rankingPanel");
const favoriteLabel = document.getElementById("favoriteLabel");
const sortedLabel = document.getElementById("sortedLabel");
const comparisonLabel = document.getElementById("comparisonLabel");
const skippedLabel = document.getElementById("skippedLabel");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const roundLabel = document.getElementById("roundLabel");
const roundEyebrow = document.getElementById("roundEyebrow");
const compareContext = document.getElementById("compareContext");
const leftChoice = document.getElementById("leftChoice");
const rightChoice = document.getElementById("rightChoice");
const leftImage = document.getElementById("leftImage");
const rightImage = document.getElementById("rightImage");
const leftName = document.getElementById("leftName");
const rightName = document.getElementById("rightName");
const rankingList = document.getElementById("rankingList");
const emptyRanking = document.getElementById("emptyRanking");
const downloadButton = document.getElementById("downloadButton");

let photos = [];
let remaining = [];
let favourites = [];
let roundQueue = [];
let contender = null;
let waitingComparison = null;
let comparisons = 0;
let skipped = 0;
let preference = new Map();
let undoHistory = [];

input.addEventListener("change", event => {
  const files = Array.from(event.target.files || []).filter(file => file.type.startsWith("image/"));
  if (files.length) startSort(files);
});

resetButton.addEventListener("click", resetApp);
undoButton.addEventListener("click", undoLastChoice);
showNamesToggle.addEventListener("change", updateNameVisibility);
leftChoice.addEventListener("click", () => choose(waitingComparison?.left.id));
rightChoice.addEventListener("click", () => choose(waitingComparison?.right.id));
downloadButton.addEventListener("click", downloadRanking);
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !undoButton.disabled) {
    event.preventDefault();
    undoLastChoice();
  }
});

function startSort(files) {
  revokePhotoUrls();
  photos = files.map((file, index) => ({
    id: `photo-${index}`,
    name: file.name,
    url: URL.createObjectURL(file)
  }));
  remaining = [...photos];
  favourites = [];
  roundQueue = [];
  contender = null;
  waitingComparison = null;
  comparisons = 0;
  skipped = 0;
  preference = new Map(photos.map(photo => [photo.id, new Set()]));
  undoHistory = [];

  undoButton.disabled = true;
  resetButton.disabled = false;
  uploadPanel.hidden = true;
  rankingPanel.hidden = false;
  donePanel.hidden = true;
  beginRound();
}

function resetApp() {
  revokePhotoUrls();
  photos = [];
  remaining = [];
  favourites = [];
  roundQueue = [];
  contender = null;
  waitingComparison = null;
  comparisons = 0;
  skipped = 0;
  preference = new Map();
  undoHistory = [];
  input.value = "";

  undoButton.disabled = true;
  resetButton.disabled = true;
  uploadPanel.hidden = false;
  comparePanel.hidden = true;
  roundProgress.hidden = true;
  rankingPanel.hidden = true;
  donePanel.hidden = true;
  updateDisplay();
}

function beginRound() {
  waitingComparison = null;

  if (!remaining.length) {
    finishSort();
    return;
  }

  if (remaining.length === 1) {
    confirmFavourite(remaining[0]);
    return;
  }

  contender = remaining[0];
  roundQueue = remaining.slice(1);
  roundProgress.hidden = false;
  updateDisplay();
  continueRound();
}

function continueRound() {
  if (waitingComparison) return;

  while (roundQueue.length) {
    const challenger = roundQueue.shift();
    const known = knownWinner(contender.id, challenger.id);

    if (known) {
      skipped += 1;
      contender = photoById(known);
      updateDisplay();
      continue;
    }

    askUser(contender, challenger);
    return;
  }

  confirmFavourite(contender);
}

function askUser(left, right) {
  waitingComparison = { left, right };
  comparisons += 1;
  leftImage.src = left.url;
  rightImage.src = right.url;
  leftImage.alt = left.name;
  rightImage.alt = right.name;
  leftName.textContent = left.name;
  rightName.textContent = right.name;
  comparePanel.hidden = false;
  updateDisplay();
}

function choose(winnerId) {
  if (!waitingComparison || !winnerId) return;

  undoHistory.push(createSnapshot());
  undoButton.disabled = false;

  const loserId = winnerId === waitingComparison.left.id
    ? waitingComparison.right.id
    : waitingComparison.left.id;

  addPreference(winnerId, loserId);
  contender = photoById(winnerId);
  waitingComparison = null;
  comparePanel.hidden = true;
  updateDisplay();
  continueRound();
}

function createSnapshot() {
  return {
    remainingIds: remaining.map(photo => photo.id),
    favouriteIds: favourites.map(photo => photo.id),
    roundQueueIds: roundQueue.map(photo => photo.id),
    contenderId: contender?.id || null,
    waitingComparisonIds: waitingComparison
      ? { left: waitingComparison.left.id, right: waitingComparison.right.id }
      : null,
    comparisons,
    skipped,
    preference: new Map(
      Array.from(preference, ([id, losers]) => [id, new Set(losers)])
    )
  };
}

function undoLastChoice() {
  const snapshot = undoHistory.pop();
  if (!snapshot) return;

  remaining = snapshot.remainingIds.map(photoById);
  favourites = snapshot.favouriteIds.map(photoById);
  roundQueue = snapshot.roundQueueIds.map(photoById);
  contender = snapshot.contenderId ? photoById(snapshot.contenderId) : null;
  waitingComparison = snapshot.waitingComparisonIds
    ? {
        left: photoById(snapshot.waitingComparisonIds.left),
        right: photoById(snapshot.waitingComparisonIds.right)
      }
    : null;
  comparisons = snapshot.comparisons;
  skipped = snapshot.skipped;
  preference = snapshot.preference;

  undoButton.disabled = undoHistory.length === 0;
  donePanel.hidden = true;
  roundProgress.hidden = false;
  showWaitingComparison();
  updateDisplay();
}

function showWaitingComparison() {
  if (!waitingComparison) {
    comparePanel.hidden = true;
    return;
  }

  const { left, right } = waitingComparison;
  leftImage.src = left.url;
  rightImage.src = right.url;
  leftImage.alt = left.name;
  rightImage.alt = right.name;
  leftName.textContent = left.name;
  rightName.textContent = right.name;
  comparePanel.hidden = false;
}

function confirmFavourite(photo) {
  favourites.push(photo);
  remaining = remaining.filter(item => item.id !== photo.id);
  contender = null;
  roundQueue = [];
  waitingComparison = null;
  comparePanel.hidden = true;
  updateDisplay();
  beginRound();
}

function finishSort() {
  comparePanel.hidden = true;
  roundProgress.hidden = true;
  donePanel.hidden = false;
  favoriteLabel.textContent = "Complete";
  updateDisplay();
}

function addPreference(winnerId, loserId) {
  const winners = [winnerId, ...photos.filter(photo => preference.get(photo.id)?.has(winnerId)).map(photo => photo.id)];
  const losers = [loserId, ...preference.get(loserId)];

  for (const winner of winners) {
    for (const loser of losers) {
      if (winner !== loser) preference.get(winner).add(loser);
    }
  }
}

function knownWinner(aId, bId) {
  if (preference.get(aId)?.has(bId)) return aId;
  if (preference.get(bId)?.has(aId)) return bId;
  return null;
}

function getEliminatedCount() {
  const activeIds = new Set(remaining.map(photo => photo.id));
  return remaining.filter(photo =>
    remaining.some(other => other.id !== photo.id && preference.get(other.id)?.has(photo.id) && activeIds.has(other.id))
  ).length;
}

function updateDisplay() {
  const roundNumber = favourites.length + 1;
  const maximum = Math.max(0, remaining.length - 1);
  const eliminated = Math.min(getEliminatedCount(), maximum);

  sortedLabel.textContent = `${favourites.length} / ${photos.length}`;
  comparisonLabel.textContent = String(comparisons);
  skippedLabel.textContent = String(skipped);

  if (photos.length && remaining.length) {
    favoriteLabel.textContent = `#${roundNumber}`;
    roundLabel.textContent = `${remaining.length} photos remain`;
    roundEyebrow.textContent = `Choosing favourite #${roundNumber}`;
    compareContext.textContent = `${eliminated} of ${maximum} ruled out`;
    progressText.textContent = `${eliminated} / ${maximum}`;
    progressBar.max = Math.max(1, maximum);
    progressBar.value = eliminated;
    progressBar.textContent = `${eliminated} of ${maximum}`;
  } else if (!photos.length) {
    favoriteLabel.textContent = "None yet";
  }

  rankingList.innerHTML = "";
  emptyRanking.hidden = favourites.length > 0;
  favourites.forEach((photo, index) => {
    const item = document.createElement("li");
    const image = document.createElement("img");
    const label = document.createElement("span");
    item.value = index + 1;
    image.src = photo.url;
    image.alt = photo.name;
    label.textContent = photo.name;
    item.append(image, label);
    rankingList.append(item);
  });

  updateNameVisibility();
}

function updateNameVisibility() {
  const hideNames = !showNamesToggle.checked;
  leftName.hidden = hideNames;
  rightName.hidden = hideNames;
  rankingList.querySelectorAll("li span").forEach(label => {
    label.hidden = hideNames;
  });
}

function photoById(id) {
  return photos.find(photo => photo.id === id);
}

function downloadRanking() {
  const lines = favourites.map((photo, index) => `${index + 1},${csvEscape(photo.name)}`);
  const blob = new Blob([`rank,file\n${lines.join("\n")}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "photo-ranking.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function revokePhotoUrls() {
  photos.forEach(photo => URL.revokeObjectURL(photo.url));
}
