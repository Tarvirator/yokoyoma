//---- FILES -------------------------------
const riveFile        = "yokoyoma-ch2_lesson.riv";
const lessonTextFile  = "lesson_text.csv";
const lessonStructFile= "lesson_structure_pos_updated.csv";
const vocabTextFile   = "vocabulary.csv";
const TOTAL_VOCAB     = 43;


// --- LESSON AUDIO ---------------------------------------------------
let currentAudio     = null; // currently playing Audio object
let audioSequenceIdx = 0;    // which audio in the sequence we're on (0 = audio1, 1 = audio2...)

function getLessonAudioSequence(lessonIdx) {
  const data = LESSON_DATA[lessonIdx];
  if (!data) return [];

  // collect non-empty audio values in order
  const seq = [];
  for (let i = 1; i <= 7; i++) {
    const a = data[`audio${i}`];
    if (a && a.trim() !== "") seq.push(`audio/${a}.mp3`);
  }
  return seq;
}

function stopLessonAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playNextLessonAudio() {
  const seq = getLessonAudioSequence(currentLessonIdx);
  if (seq.length === 0) return;

  const path = seq[audioSequenceIdx % seq.length];
  audioSequenceIdx++;

  stopLessonAudio();
  currentAudio = new Audio(path);
  currentAudio.play().catch(err => console.warn("Audio play failed:", err));
}

function resetLessonAudio() {
  stopLessonAudio();
  audioSequenceIdx = 0;
}

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
// List lessons that should NOT repeat — everything else repeats REPEAT_COUNT times
const NO_REPEAT_LESSONS = new Set([9, 17, 22, 34, 61, 69, 80, 98, 125, 143]);

const REPEAT_COUNT = 3;

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



// --- FIRST INTERACTION AUDIO ----------------------------------------
let homeSongPlayed = false;

const firstInteractionEvents = ["click", "keydown", "touchstart", "pointerdown"];

firstInteractionEvents.forEach(event => {
  canvas.addEventListener(event, playHomeAudioOnFirstInteraction);
});

function playHomeAudioOnFirstInteraction() {
  if (homeSongPlayed) return;
  homeSongPlayed = true;

  console.log("first interaction — playing home audio");

  firstInteractionEvents.forEach(event => {
  canvas.removeEventListener(event, playHomeAudioOnFirstInteraction);
});

  currentAudio = new Audio("audio/cover_song64kbps.mp3");
  currentAudio.play().catch(err => console.warn("Home audio failed:", err));
}


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

  resetLessonAudio(); // stop previous audio, reset sequence

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
  }
}

function hardResetLesson(thenGoTo) {
  const vm = r.viewModelInstance;
  if (!vm) return;

  resetLessonAudio(); // stop and reset audio sequence

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
  resetLessonAudio();
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

  const vocabIdx = audioList[idx];
  const slotIdx  = imageList.indexOf(vocabIdx);

  currentVocabIdx = vocabIdx;
  gameVM.number("current").value = slotIdx;

  // play audio from JS after short delay
  setTimeout(() => {
    const audioFile = vocabTexts[vocabIdx]?.[3];
    if (!audioFile) return;
    stopLessonAudio();
    currentAudio = new Audio(`audio/${audioFile}.mp3`);
    currentAudio.play().catch(err => console.warn("Game audio play failed:", err));
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
  const langIdx = Math.round(vm.number("languageIdx").value);

  // stop any playing audio on page change
  stopLessonAudio();
  lastVocabCardClicked = -1;

  const startIdx = vocabPage * CARD_COUNT;

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
  const previousAudio = currentAudio;
  currentAudio = null;
  if (previousAudio) {
    previousAudio.pause();
    previousAudio.currentTime = 0;
  }

  if (stateNum === 6) {
    currentAudio = new Audio("audio/aiueo64kbps.mp3");
    currentAudio.play().catch(err => console.warn("State 6 audio failed:", err));
  }

  // ... rest of transition logic

      if (lastStateNum === 1) {
        if (stateNum === 0) {
          hardResetLesson(0);
        } else {
          const lessonVM = vm.viewModel("propertyOfLessonVM");
          if (lessonVM) lessonVM.number("lessonIdx").value = -1;
        }
        lastLangIdx = -1;
      }

      // entering lesson
      if (stateNum === 1) {
        if (lastState === 0) {
          hardResetLesson(0);
        }
        // from any other state → resume at currentLessonIdx
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
    fit: rive.Fit.Layout,
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

    // ── ESC key → exittrigger ──────────────────────────────────────
   window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const stateNum  = Math.round(parseFloat(vm.string("stateNum").value));
    const lastState = Math.round(vm.number("lastState").value);

    if (lastState !== 1) {
      // not coming from lesson — just exit
      vm.trigger("exittrigger").trigger();
    } else {
      // coming from lesson — trigger mode-specific return
      switch (stateNum) {
        case 2:
          vm.viewModel("propertyOfGameControlVM").trigger("returnTriggerGame").trigger();
          break;
        case 3:
          vm.viewModel("propertyOfVocabControlVM").trigger("returnTriggerVocabPage").trigger();
          break;
        case 4:
          vm.viewModel("propertyOfPatternControlVM").trigger("patternReturnTrigger").trigger();
          break;
        case 5:
          vm.viewModel("propertyOfAlphabetControlVM").trigger("returnAlphaTrigger").trigger();
          break;
        default:
          vm.trigger("exittrigger").trigger();
          break;
      }
    }
  });
    // Lesson Trigger
    const lessonVM = vm.viewModel("propertyOfLessonVM");
    lessonVM.trigger("audioPlayTrigger").on(() => {
      playNextLessonAudio();
    });

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

    mediaPlayerVM.trigger("playPauseTrigger").on(() => {
      if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
      } else if (currentAudio) {
        currentAudio.play().catch(err => console.warn("Play failed:", err));
      }
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

    const audioFile = vocabTexts[currentVocabIdx]?.[3];
    if (!audioFile) return;
    stopLessonAudio();
    currentAudio = new Audio(`audio/${audioFile}.mp3`);
    currentAudio.play().catch(err => console.warn("Listen again audio play failed:", err));
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

    let cardTriggerDebounce = false;
    vocabVM.trigger("cardTrigger").on(() => {
      console.log("triggered")
      if (cardTriggerDebounce) return;
      cardTriggerDebounce = true;
      setTimeout(() => cardTriggerDebounce = false, 300);

      const cardClicked   = Math.round(vocabVM.number("VocabCardClicked").value);
      // const actualCardIdx = vocabPage * CARD_COUNT + cardClicked;

      // get the vocabIdx assigned to this slot
      const vocabIdx = Math.round(vocabVM.number(`card${cardClicked}`).value);
      if (vocabIdx < 0) return; // sentinel or empty slot

      // get audio filename from vocabTexts[vocabIdx][3] (fr column = audio name)
      const audioFile = vocabTexts[vocabIdx]?.[3];
      if (!audioFile) return;

      // stop any playing audio and play new one
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      currentAudio = new Audio(`audio/${audioFile}.mp3`);
      currentAudio.play().catch(err => console.warn("Vocab audio play failed:", err));
    });

    // pattern page triggers
    const patternVM        = vm.viewModel("propertyOfPatternVM");
    const patternControlVM = vm.viewModel("propertyOfPatternControlVM");


    patternControlVM.trigger("patternNextTrigger").on(() => {
      const current = Math.round(patternVM.number("patternPageIdx").value);
      patternVM.number("patternPageIdx").value = Math.min(4, current + 1);
    });
    patternControlVM.trigger("patternPrevTrigger").on(() => {
      const current = Math.round(patternVM.number("patternPageIdx").value);
      patternVM.number("patternPageIdx").value = Math.max(0, current - 1);
    });

    // Alpha page triggers
    const AlphabetVM        = vm.viewModel("propertyOfAlphabetVM");
    const AlphabetControlVM = vm.viewModel("propertyOfAlphabetControlVM");


    AlphabetControlVM.trigger("nextalpatrigger").on(() => {
      const current = Math.round(AlphabetVM.number("alphabetPage").value);
      AlphabetVM.number("alphabetPage").value = Math.min(1, current + 1);
    });
    AlphabetControlVM.trigger("prevalpatrigger").on(() => {
      const current = Math.round(AlphabetVM.number("alphabetPage").value);
      AlphabetVM.number("alphabetPage").value = Math.max(0, current - 1);
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