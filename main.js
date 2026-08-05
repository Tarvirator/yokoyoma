//---- FILES -------------------------------
const riveFile = "yokoyoma-ch1.riv";
const lessonTextFile = "lessonsnew.csv";
const vocabTextFile = "vocab.csv";
const TOTAL_VOCAB = 43;

// --- LESSON STRUCTURE -----------------------------------------------
const LAST_LESSON_IDX = 50;
const SUBLESSONS      = [[5, 3], [9,3],[18,3]];
const LESSON_COUNT    = LAST_LESSON_IDX + 1;
const CHAPTER_STARTS  = [0, 4, 5,9,13,17,18,22,26,30];

function buildMainLessons() {
  const subRanges = SUBLESSONS.map(([start, count]) => ({ start, end: start + count - 1 }));
  const mains = [];
  for (let i = 0; i <= LAST_LESSON_IDX; i++) {
    const isMidSub = subRanges.some(({ start, end }) => i > start && i <= end);
    if (!isMidSub) mains.push(i);
  }
  return mains;
}

const MAIN_LESSONS = buildMainLessons();

function getChapterOf(lessonIdx) {
  for (let i = CHAPTER_STARTS.length - 1; i >= 0; i--) {
    if (lessonIdx >= CHAPTER_STARTS[i]) return i;
  }
  return 0;
}

function getNextMainLesson(lessonIdx) {
  return MAIN_LESSONS.find(idx => idx > lessonIdx) ?? lessonIdx;
}

function getPrevMainLesson(lessonIdx) {
  return [...MAIN_LESSONS].reverse().find(idx => idx < lessonIdx) ?? lessonIdx;
}


// --- REPEAT STRUCTURE -----------------------------------------------
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const REPEAT_COUNT      = 3;
const NO_REPEAT_LESSONS = new Set([9, 10, 11, 17, 24, 34, 46]);

let repeatPlayCount   = 0;
let activeRepeatGroup = null;

function getRepeatGroup(lessonIdx) {
  if (NO_REPEAT_LESSONS.has(lessonIdx)) return null;
  return [lessonIdx];
}

function resetRepeat() {
  repeatPlayCount   = 0;
  activeRepeatGroup = null;
}


// --- CANVAS SETUP ---------------------------------------------------
const canvas = document.getElementById("canvas");

function setCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
}

setCanvasSize();


// --- LESSON TEXTS ---------------------------------------------------
let lessonTexts = {};

async function loadLessonTexts() {
  const res = await fetch(lessonTextFile);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);

  rows.forEach(row => {
    const [lessonIdx, line, en, ja, es, fr] = row.split("|");
    const t = parseInt(lessonIdx);
    const l = parseInt(line);

    if (!lessonTexts[t]) lessonTexts[t] = {};

    [en, ja, es, fr].forEach((val, langIdx) => {
      if (!lessonTexts[t][langIdx]) lessonTexts[t][langIdx] = {};
      lessonTexts[t][langIdx][`line${l}`] = (val ?? "").trim();
    });
  });
}

function setLessonText(line1, line2, line3) {
  const vm = r.viewModelInstance;
  if (!vm) return;

  const lessonVM = vm.viewModel("propertyOfLessonVM");
  if (!lessonVM) return;

  lessonVM.string("line1").value = line1;
  lessonVM.string("line2").value = line2;
  lessonVM.string("line3").value = line3;
}


// --- LESSON NAVIGATION ----------------------------------------------
let currentLessonIdx = 0;

function goToLesson(idx) {
  currentLessonIdx = Math.max(0, Math.min(idx, LESSON_COUNT - 1));

  const vm = r.viewModelInstance;
  if (!vm) return;

  const langIdx = Math.round(vm.number("languageIdx").value);
  const texts   = lessonTexts[currentLessonIdx]?.[langIdx];
  if (texts) setLessonText(texts.line1, texts.line2, texts.line3);

  const lessonVM = vm.viewModel("propertyOfLessonVM");
  if (lessonVM) lessonVM.number("lessonIdx").value = currentLessonIdx;
}

function resetLesson() {
  currentLessonIdx = 0;
  lastStartEnd     = -1;
  lastLangIdx      = -1;
  resetRepeat();
}


// --- VOCAB TEXTS ---------------------------------------------------
let vocabTexts = {};

async function loadVocabTexts() {
  const res = await fetch(vocabTextFile);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);

  rows.forEach(row => {
    const [cardIdx, en, ja, es, fr] = row.split(",");
    const c = parseInt(cardIdx);

    vocabTexts[c] = {
      0: en.trim(),
      1: ja.trim(),
      2: es.trim(),
      3: fr.trim(),
    };
  });
}

function setVocabTexts(langIdx) {
  const vm      = r.viewModelInstance;
  const vocabVM = vm.viewModel("propertyOfVocabularyVM");
  const startIdx = vocabPage * CARD_COUNT;

  for (let slot = 0; slot < CARD_COUNT; slot++) {
    const cardIdx = startIdx + slot;
    vocabVM.string(`text${slot}`).value = cardIdx < TOTAL_VOCAB
      ? vocabTexts[cardIdx]?.[langIdx] ?? ""
      : "";
  }
}


// --- GAME LOGIC ------------------------------------------------------
const SLOT_COUNT = 9;

let imageList       = [];
let audioList       = [];
let lastCorrect     = -1;
let currentVocabIdx = -1;

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function startGame() {
  const all = Array.from({ length: TOTAL_VOCAB }, (_, i) => i);
  imageList = shuffle(all).slice(0, SLOT_COUNT);

  const vm     = r.viewModelInstance;
  const gameVM = vm.viewModel("propertyOfGameVM");

  gameVM.number("correct").value = 0;
  lastCorrect     = -1;
  currentVocabIdx = -1;

  imageList.forEach((vocabIdx, slotIdx) => {
    gameVM.number(`slot${slotIdx}`).value = vocabIdx;
  });

  audioList = shuffle(imageList);
  setCurrentQuestion(0);
}

function setCurrentQuestion(idx) {
  const vm      = r.viewModelInstance;
  const gameVM  = vm.viewModel("propertyOfGameVM");
  const audioVM = gameVM.viewModel("propertyOfVocabAudioVM");

  const vocabIdx = audioList[idx];
  const slotIdx  = imageList.indexOf(vocabIdx);

  currentVocabIdx = vocabIdx;
  gameVM.number("current").value = slotIdx;

  // reset audio first, then set after 1 second
  audioVM.number("audioIdx").value = -1;
  setTimeout(() => {
    audioVM.number("audioIdx").value = vocabIdx;
  }, 500);
}


// --- VOCAB CARD LOGIC ------------------------------------------------
const CARD_COUNT = 12;
const SENTINEL   = -99;

let vocabPage            = 0;
let lastVocabCardClicked = -1;
let lastVocabLangIdx     = -1;

const totalPages = Math.ceil(TOTAL_VOCAB / CARD_COUNT);

function setVocabPage(page) {
  vocabPage = Math.max(0, Math.min(page, totalPages - 1));

  const vm      = r.viewModelInstance;
  const vocabVM = vm.viewModel("propertyOfVocabularyVM");
  const audioVM = vocabVM.viewModel("propertyOfVocabAudioVM");
  const langIdx = Math.round(vm.number("languageIdx").value);

  const startIdx = vocabPage * CARD_COUNT;

  audioVM.number("audioIdx").value = -1;
  lastVocabCardClicked = -1;

  for (let slot = 0; slot < CARD_COUNT; slot++) {
    const cardIdx = startIdx + slot;

    if (cardIdx < TOTAL_VOCAB) {
      vocabVM.number(`card${slot}`).value    = cardIdx;
      vocabVM.string(`text${slot}`).value    = vocabTexts[cardIdx]?.[langIdx] ?? "";
      vocabVM.number(`opacity${slot}`).value = 100;
    } else {
      vocabVM.number(`card${slot}`).value    = SENTINEL;
      vocabVM.string(`text${slot}`).value    = "";
      vocabVM.number(`opacity${slot}`).value = 0;
    }
  }
}

function startVocab(langIdx) {
  lastVocabCardClicked = -1;
  lastVocabLangIdx     = langIdx;
  setVocabPage(0);
}


// --- POLLING LOOP ---------------------------------------------------
let lastStateNum = -1;
let lastLangIdx  = -1;
let lastStartEnd = -1;

function poll() {
  const vm = r.viewModelInstance;
  if (vm) {
    const stateNum = Math.round(parseFloat(vm.string("stateNum").value));
    const langIdx  = Math.round(vm.number("languageIdx").value);

    // detect state transitions
    if (stateNum !== lastStateNum) {

      // leaving lesson
      if (lastStateNum === 1) {
        const lessonVM = vm.viewModel("propertyOfLessonVM");
        if (lessonVM) lessonVM.number("lessonIdx").value = -1;
        lastLangIdx = -1;
      }

      // entering lesson — reset JS state only
      if (stateNum === 1) {
        resetLesson();
      }

      if (stateNum === 2) startGame();
      if (stateNum === 3) startVocab(langIdx);

      // leaving lesson — reset lessonIdx in Rive (non-lesson states)
      if (stateNum !== 1 && lastStateNum !== 1) {
        const lessonVM = vm.viewModel("propertyOfLessonVM");
        if (lessonVM) lessonVM.number("lessonIdx").value = -1;
      }

      lastStateNum = stateNum;
    }

    // lesson logic
    if (stateNum === 1) {
      if (langIdx !== lastLangIdx) {
        const texts = lessonTexts[currentLessonIdx]?.[langIdx];
        if (texts) setLessonText(texts.line1, texts.line2, texts.line3);

        const lessonVM = vm.viewModel("propertyOfLessonVM");
        if (lessonVM) lessonVM.number("lessonIdx").value = currentLessonIdx;
      }

      const lessonVM = vm.viewModel("propertyOfLessonVM");
      const startEnd = Math.round(lessonVM.number("startend").value);

      // only act on 0 → 1 transition
      if (startEnd === 1 && lastStartEnd === 0 && currentLessonIdx < LESSON_COUNT - 1) {
        const group = getRepeatGroup(currentLessonIdx);

        if (group) {
          if (!activeRepeatGroup || activeRepeatGroup[0] !== group[0]) {
            activeRepeatGroup = group;
            repeatPlayCount   = 1;
          }

          const isLastInGroup = currentLessonIdx === group[group.length - 1];

          if (isLastInGroup) {
            if (repeatPlayCount < REPEAT_COUNT) {
              repeatPlayCount++;
              goToLesson(group[0]);
            } else {
              resetRepeat();
              goToLesson(currentLessonIdx + 1);
            }
          } else {
            goToLesson(currentLessonIdx + 1);
          }
        } else {
          resetRepeat();
          goToLesson(currentLessonIdx + 1);
        }
      }

      lastStartEnd = startEnd;
    }

    // game logic
    if (stateNum === 2) {
      const gameVM  = vm.viewModel("propertyOfGameVM");
      // console.log("gameVM:", gameVM.properties);
      const confettiVM= vm.viewModel("propertyOfConfettiVM")
      // console.log("confettiVM:", confettiVM.properties);
      const correct = Math.round(gameVM.number("correct").value);

      if (correct !== lastCorrect) {
        lastCorrect = correct;
        if (correct < SLOT_COUNT) {
          setCurrentQuestion(correct);
        } else {
          console.log("game complete!");
          setTimeout(() => {
            gameVM.number("correct").value = -1;
          }, 1000);
          

        }
      }
    }

    // vocab card logic
    if (stateNum === 3) {
      const vocabVM = vm.viewModel("propertyOfVocabularyVM");
      if (!vocabVM) { requestAnimationFrame(poll); return; }

      const audioVM = vocabVM.viewModel("propertyOfVocabAudioVM");
      if (!audioVM) { requestAnimationFrame(poll); return; }

      if (langIdx !== lastVocabLangIdx) {
        lastVocabLangIdx = langIdx;
        setVocabTexts(langIdx);
      }
    }

    lastLangIdx = langIdx;
  }
  requestAnimationFrame(poll);
}


// --- RIVE INSTANCE ---------------------------------------------------
const r = new rive.Rive({
  src: riveFile,
  canvas,
  autoplay: true,
  autoBind: true,
  artboard: "Artboard",
  stateMachines: "State Machine 1",
  layout: new rive.Layout({
    fit: rive.Fit.Cover,
    alignment: rive.Alignment.Center,
  }),
  onLoad: async () => {
    r.resizeDrawingSurfaceToCanvas();
    await loadLessonTexts();
    await loadVocabTexts();
    poll();

    const vm = r.viewModelInstance;

    // media player triggers (lesson navigation)
    const mediaPlayerVM = vm.viewModel("propertyOfMediaPlayerVM");
    mediaPlayerVM.trigger("forwardTrigger").on(() => {
      resetRepeat();
      lastStartEnd = -1;
      goToLesson(getNextMainLesson(currentLessonIdx));
    });
    mediaPlayerVM.trigger("backwardTrigger").on(() => {
      resetRepeat();
      lastStartEnd = -1;
      goToLesson(getPrevMainLesson(currentLessonIdx));
    });
    mediaPlayerVM.trigger("endTrigger").on(() => {
      resetRepeat();
      lastStartEnd = -1;
      const next = getChapterOf(currentLessonIdx) + 1;
      if (next < CHAPTER_STARTS.length) goToLesson(CHAPTER_STARTS[next]);
    });
    mediaPlayerVM.trigger("startTrigger").on(() => {
      resetRepeat();
      lastStartEnd = -1;
      const prev = getChapterOf(currentLessonIdx) - 1;
      if (prev >= 0) goToLesson(CHAPTER_STARTS[prev]);
    });

    // game triggers
    const gameControlVM = vm.viewModel("propertyOfGameControlVM");
    gameControlVM.trigger("newGameTrigger").on(() => {
      startGame();
    });
    gameControlVM.trigger("listenAgainTrigger").on(() => {
      if (currentVocabIdx === -1) return;
      const audioVM = vm.viewModel("propertyOfGameVM").viewModel("propertyOfVocabAudioVM");
      audioVM.number("audioIdx").value = currentVocabIdx;
    });

    // vocab page triggers
    const vocabControlVM = vm.viewModel("propertyOfVocabControlVM");
    vocabControlVM.trigger("nextPageTrigger").on(() => {
      setVocabPage(vocabPage + 1);
    });
    vocabControlVM.trigger("previousPageTrigger").on(() => {
      setVocabPage(vocabPage - 1);
    });

    // vocab card trigger
    const vocabVM      = vm.viewModel("propertyOfVocabularyVM");
    const vocabAudioVM = vocabVM.viewModel("propertyOfVocabAudioVM");

    let cardTriggerDebounce = false;

    vocabVM.trigger("cardTrigger").on(() => {
      if (cardTriggerDebounce) return;
      cardTriggerDebounce = true;
      setTimeout(() => cardTriggerDebounce = false, 300);

      const cardClicked   = Math.round(vocabVM.number("VocabCardClicked").value);
      const actualCardIdx = vocabPage * CARD_COUNT + cardClicked;

      // reset to -1 first so Rive always sees a change
      vocabAudioVM.number("audioIdx").value = -1;
      setTimeout(() => {
        vocabAudioVM.number("audioIdx").value = actualCardIdx;
      }, 50);
    });

    // pattern page triggers
    const patternVM = vm.viewModel("propertyOfPatternVM");
    patternVM.trigger("patternNextTrigger").on(() => {
      const current = Math.round(patternVM.number("patternPageIdx").value);
      patternVM.number("patternPageIdx").value = current + 1;
    });
    patternVM.trigger("patternPrevTrigger").on(() => {
      const current = Math.round(patternVM.number("patternPageIdx").value);
      patternVM.number("patternPageIdx").value = Math.max(0, current - 1);
    });

    // set initial lesson
    goToLesson(0);
  },
});


// --- RESIZE HANDLER ------------------------------------------------
window.addEventListener("resize", () => {
  setCanvasSize();
  r.resizeDrawingSurfaceToCanvas();
});