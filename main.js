//---- FILES -------------------------------
const riveFile        = "yokoyoma-ch1.riv";
const lessonTextFile  = "lesson_text.csv";
const lessonStructFile= "lesson_structure_pos_updated.csv";
const vocabTextFile   = "vocab.csv";
const TOTAL_VOCAB     = 43;

// --- LESSON STRUCTURE -----------------------------------------------
const SUBLESSONS     = [[5, 3], [9,3],[18,3],[31,2],[42,3],[51,4],[77,2],[94,3],[103,4],[139,3]];
const CHAPTER_STARTS = [0, 4, 5,9,13,17,18,22,26,30,31,34,37,41,42,46,51,56,63,67,68,69,72,76,
  77,80,83,89,93,94,98,103,108,113,117,121,122,125,130,134,135,136,137,138,139,143,144,147];

let LESSON_COUNT = 0;
let LESSON_DATA  = {};

async function loadLessonStructure() {
  const res  = await fetch(lessonStructFile);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);

  rows.forEach(row => {
    const cols = row.replace(/\r/g, "").split(",");
    const idx  = parseInt(cols[0]);

    LESSON_DATA[idx] = {
      type  : parseInt(cols[1])   || 0,
      audio1: (cols[2]  ?? "").trim(),
      audio2: (cols[3]  ?? "").trim(),
      audio3: (cols[4]  ?? "").trim(),
      audio4: (cols[5]  ?? "").trim(),
      audio5: (cols[6]  ?? "").trim(),
      audio6: (cols[7]  ?? "").trim(),
      audio7: (cols[8]  ?? "").trim(),
      vocab1: parseInt(cols[9])   || 0,
      vocab2: parseInt(cols[10])  || 0,
      vocab3: parseInt(cols[11])  || 0,
      vocab4: parseInt(cols[12])  || 0,
      vocab5: parseInt(cols[13])  || 0,
      vocab6: parseInt(cols[14])  || 0,
      vocab7: parseInt(cols[15])  || 0,
      pos1  : parseInt(cols[16])  || 0,
      pos2  : parseInt(cols[17])  || 0,
      pos3  : parseInt(cols[18])  || 0,
      pos4  : parseInt(cols[19])  || 0,
      pos5  : parseInt(cols[20])  || 0,
      pos6  : parseInt(cols[21])  || 0,
      pos7  : parseInt(cols[22])  || 0,
    };

    LESSON_COUNT = Math.max(LESSON_COUNT, idx + 1);
  });
}

function buildMainLessons() {
  const subRanges = SUBLESSONS.map(([start, count]) => ({ start, end: start + count - 1 }));
  const mains = [];
  for (let i = 0; i < LESSON_COUNT; i++) {
    const isMidSub = subRanges.some(({ start, end }) => i > start && i <= end);
    if (!isMidSub) mains.push(i);
  }
  return mains;
}

let MAIN_LESSONS = [];

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
const REPEAT_STRUCTURE = [
  { from: 0,   to: 8   },
  { from: 10,  to: 16  },
  { from: 18,  to: 21  },
  { from: 23,  to: 33  },
  { from: 35,  to: 45  },
  { from: 47,  to: 60  },
  { from: 62,  to: 68  },
  { from: 70,  to: 79  },
  { from: 81,  to: 97  },
  { from: 99,  to: 124 },
  { from: 126, to: 142 },
  { from: 144, to: 146 },
];

function buildRepeatGroups(structure) {
  const map = new Map();
  structure.forEach(entry => {
    if (typeof entry === "number") {
      map.set(entry, [entry]);
    } else if (Array.isArray(entry)) {
      entry.forEach(idx => map.set(idx, entry));
    } else if (entry && typeof entry === "object" && "from" in entry && "to" in entry) {
      for (let i = entry.from; i <= entry.to; i++) {
        map.set(i, [i]);
      }
    }
  });
  return map;
}

const REPEAT_GROUPS = buildRepeatGroups(REPEAT_STRUCTURE);
const REPEAT_COUNT  = 3;

let repeatPlayCount   = 0;
let activeRepeatGroup = null;

function getRepeatGroup(lessonIdx) {
  return REPEAT_GROUPS.get(lessonIdx) ?? null;
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
  const res  = await fetch(lessonTextFile);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);

  rows.forEach(row => {
    const [lessonIdx, line, kanji, hiragana, hon, book] = row.replace(/\r/g, "").split("|");
    const t = parseInt(lessonIdx);
    const l = parseInt(line);

    if (!lessonTexts[t]) lessonTexts[t] = {};

    [kanji, hiragana, hon, book].forEach((val, langIdx) => {
      if (!lessonTexts[t][langIdx]) lessonTexts[t][langIdx] = {};
      lessonTexts[t][langIdx][`line${l}`] = (val ?? "").trim();
    });
  });
}

function setLessonText(texts) {
  const vm = r.viewModelInstance;
  if (!vm) return;

  const lessonVM = vm.viewModel("propertyOfLessonVM");
  if (!lessonVM) return;

  for (let i = 1; i <= 5; i++) {
    lessonVM.string(`line${i}`).value = texts[`line${i}`] ?? "";
  }
}


// --- LESSON NAVIGATION ----------------------------------------------
let currentLessonIdx = 0;

function goToLesson(idx) {
  currentLessonIdx = Math.max(0, Math.min(idx, LESSON_COUNT - 1));

  const vm = r.viewModelInstance;
  if (!vm) return;

  const langIdx = Math.round(vm.number("languageIdx").value);
  const texts   = lessonTexts[currentLessonIdx]?.[langIdx];
  if (texts) setLessonText(texts);

  const lessonVM = vm.viewModel("propertyOfLessonVM");
  if (!lessonVM) return;

  const data = LESSON_DATA[currentLessonIdx];
  if (!data) return;

  lessonVM.number("lessonIdx").value  = currentLessonIdx;
  lessonVM.number("lessonType").value = data.type;

  for (let i = 1; i <= 7; i++) {
    lessonVM.number(`pos${i}`).value   = data[`pos${i}`];
    lessonVM.number(`vocab${i}`).value = data[`vocab${i}`];
    lessonVM.string(`audio${i}`).value = data[`audio${i}`];
  }
}

function hardResetLesson(thenGoTo) {
  // momentarily set sentinels so Rive detects a real change
  const vm = r.viewModelInstance;
  if (!vm) return;

  const lessonVM = vm.viewModel("propertyOfLessonVM");
  if (lessonVM) {
    lessonVM.number("lessonIdx").value  = -100;
    lessonVM.number("lessonType").value = -100;
  }

  lastStartEnd = -1;
  lastLangIdx  = -1;
  resetRepeat();

  setTimeout(() => goToLesson(thenGoTo), 50);
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
  const res  = await fetch(vocabTextFile);
  const text = await res.text();
  const rows = text.trim().split("\n").slice(1);

  rows.forEach(row => {
    const [cardIdx, en, ja, es, fr] = row.replace(/\r/g, "").split(",");
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
    const stateNum  = Math.round(parseFloat(vm.string("stateNum").value));
    const lastState = Math.round(vm.number("lastState").value);
    const langIdx   = Math.round(vm.number("languageIdx").value);

    // detect state transitions
    if (stateNum !== lastStateNum) {

      // leaving lesson
    if (lastStateNum === 1) {
      if (stateNum === 0) {
        // resetLesson();
        hardResetLesson(0);
      } else {
        const lessonVM = vm.viewModel("propertyOfLessonVM");
        // if (lessonVM) lessonVM.number("lessonIdx").value = -1;
      }
      lastLangIdx = -1;
    }

      // entering lesson
      if (stateNum === 1) {
        if (lastState === 0) {
          // coming from homepage → always fresh start
          // resetLesson();
          hardResetLesson(0);
        }
        // coming from any other state → resume (no reset, currentLessonIdx preserved)
      }

      if (stateNum === 2) startGame();
      if (stateNum === 3) startVocab(langIdx);

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
        if (texts) setLessonText(texts);

        const lessonVM = vm.viewModel("propertyOfLessonVM");
        if (lessonVM) {
          lessonVM.number("lessonIdx").value  = currentLessonIdx;
          lessonVM.number("lessonType").value = LESSON_DATA[currentLessonIdx]?.type ?? 0;
        }
      }

      const lessonVM = vm.viewModel("propertyOfLessonVM");
      const startEnd = Math.round(lessonVM.number("startend").value);

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
    await loadLessonStructure();
    await loadLessonTexts();
    await loadVocabTexts();

    MAIN_LESSONS = buildMainLessons();

    poll();

    const vm = r.viewModelInstance;

    // media player triggers
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
    mediaPlayerVM.trigger("repeatTrigger").on(() => {
      lastStartEnd = -1;
      hardResetLesson(currentLessonIdx);
    });

    // game triggers
    const gameControlVM = vm.viewModel("propertyOfGameControlVM");
    gameControlVM.trigger("newGameTrigger").on(() => {
      startGame();
    });

    let listenAgainDebounce = false;
    gameControlVM.trigger("listenAgainTrigger").on(() => {
      if (listenAgainDebounce) return;
      if (currentVocabIdx === -1) return;

      listenAgainDebounce = true;
      setTimeout(() => listenAgainDebounce = false, 300);

      const audioVM = vm.viewModel("propertyOfGameVM").viewModel("propertyOfVocabAudioVM");
      audioVM.number("audioIdx").value = -1;
      setTimeout(() => {
        audioVM.number("audioIdx").value = currentVocabIdx;
      }, 50);
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