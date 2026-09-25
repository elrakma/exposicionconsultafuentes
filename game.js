"use strict";

// Para cambiar el contenido, edita solamente esta lista.
const WORDS = [
  { label: "INVESTIGACIÓN", key: "INVESTIGACION" },
  { label: "TEORÍA", key: "TEORIA" },
  { label: "MÉTODO", key: "METODO" },
  { label: "PROBLEMA", key: "PROBLEMA" },
  { label: "EVIDENCIA", key: "EVIDENCIA" },
  { label: "CIENCIA", key: "CIENCIA" },
  { label: "MARTÍNEZ", key: "MARTINEZ" },
  { label: "GIROUX", key: "GIROUX" },
  { label: "SARTORI", key: "SARTORI" },
];

const GRID_SIZE = 15;

const DIRECTIONS = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

const elements = {
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector("#start-button"),
  gameShell: document.querySelector("#game-shell"),
  grid: document.querySelector("#word-grid"),
  wordList: document.querySelector("#word-list"),
  statusText: document.querySelector("#status-text"),
  foundCount: document.querySelector("#found-count"),
  totalCount: document.querySelector("#total-count"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  resetButton: document.querySelector("#reset-button"),
  soundButton: document.querySelector("#sound-button"),
  soundIcon: document.querySelector("#sound-icon"),
  explosionLayer: document.querySelector("#explosion-layer"),
  outro: document.querySelector("#outro"),
  crawl: document.querySelector("#crawl"),
  replayButton: document.querySelector("#replay-button"),

  // NUEVO
  finalQuestion: document.querySelector("#final-question"),
};

let grid = [];
let placements = [];
let foundWords = new Set();
let selectionAnchor = null;
let selectedCells = [];
let dragState = null;
let interactionLocked = false;
let replayTimer = null;

class RetroAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.loopTimer = null;
    this.muted = false;
  }

  async start() {
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  tone(frequency, start, duration, options = {}) {
    if (!this.context || !this.master || this.muted) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = options.type || "square";
    oscillator.frequency.setValueAtTime(frequency, start);

    if (options.slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(
        options.slideTo,
        start + duration,
      );
    }

    const volume = options.volume ?? 0.2;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.015,
    );

    gain.gain.setValueAtTime(
      volume,
      Math.max(
        start + 0.02,
        start + duration - 0.055,
      ),
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration,
    );

    oscillator.connect(gain);
    gain.connect(this.master);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  startTensionLoop() {
    this.stopLoop();

    const playPhrase = () => {
      if (!this.context || this.muted) return;

      const now = this.context.currentTime + 0.03;

      const notes = [
        146.83,
        174.61,
        220,
        174.61,
        164.81,
        196,
        246.94,
        196,
      ];

      notes.forEach((note, index) => {
        this.tone(
          note,
          now + index * 0.19,
          0.105,
          {
            type: index % 2
              ? "square"
              : "triangle",
            volume: 0.13,
          },
        );
      });

      this.tone(
        73.42,
        now,
        0.7,
        {
          type: "triangle",
          volume: 0.09,
        },
      );

      this.tone(
        82.41,
        now + 0.78,
        0.7,
        {
          type: "triangle",
          volume: 0.09,
        },
      );
    };

    playPhrase();

    this.loopTimer =
      window.setInterval(
        playPhrase,
        1850,
      );
  }

  stopLoop() {
    if (this.loopTimer) {
      window.clearInterval(
        this.loopTimer,
      );
    }

    this.loopTimer = null;
  }

  success() {
    if (!this.context) return;

    const now =
      this.context.currentTime;

    [
      523.25,
      659.25,
      783.99,
    ].forEach(
      (note, index) => {
        this.tone(
          note,
          now + index * 0.08,
          0.18,
          {
            type: "square",
            volume: 0.18,
          },
        );
      },
    );
  }

  error() {
    if (!this.context) return;

    const now =
      this.context.currentTime;

    this.tone(
      155.56,
      now,
      0.11,
      {
        type: "sawtooth",
        volume: 0.12,
      },
    );

    this.tone(
      138.59,
      now + 0.12,
      0.13,
      {
        type: "sawtooth",
        volume: 0.12,
      },
    );
  }

  explosion() {
    if (
      !this.context ||
      !this.master ||
      this.muted
    ) {
      return;
    }

    const duration = 0.75;

    const buffer =
      this.context.createBuffer(
        1,
        Math.floor(
          this.context.sampleRate *
            duration,
        ),
        this.context.sampleRate,
      );

    const data =
      buffer.getChannelData(0);

    for (
      let index = 0;
      index < data.length;
      index += 1
    ) {
      data[index] =
        (Math.random() * 2 - 1) *
        (1 - index / data.length);
    }

    const source =
      this.context.createBufferSource();

    const filter =
      this.context.createBiquadFilter();

    const gain =
      this.context.createGain();

    source.buffer = buffer;

    filter.type = "lowpass";

    filter.frequency.setValueAtTime(
      1100,
      this.context.currentTime,
    );

    filter.frequency.exponentialRampToValueAtTime(
      90,
      this.context.currentTime +
        duration,
    );

    gain.gain.setValueAtTime(
      0.26,
      this.context.currentTime,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.context.currentTime +
        duration,
    );

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    source.start();
  }

  finale() {
    if (!this.context) return;

    const now =
      this.context.currentTime +
      0.05;

    const melody = [
      [261.63, 0, 0.42],
      [392, 0.45, 0.42],
      [523.25, 0.9, 0.75],
      [493.88, 1.72, 0.28],
      [440, 2.04, 0.28],
      [659.25, 2.38, 0.85],
      [587.33, 3.28, 0.32],
      [523.25, 3.64, 1.05],
      [392, 4.82, 0.42],
      [440, 5.28, 0.42],
      [523.25, 5.74, 1.2],
    ];

    melody.forEach(
      ([frequency, offset, duration]) => {
        this.tone(
          frequency,
          now + offset,
          duration,
          {
            type: "sawtooth",
            volume: 0.1,
          },
        );

        this.tone(
          frequency / 2,
          now + offset,
          duration,
          {
            type: "triangle",
            volume: 0.14,
          },
        );
      },
    );

    [
      65.41,
      73.42,
      87.31,
    ].forEach(
      (bass, index) => {
        this.tone(
          bass,
          now + index * 2.35,
          2.1,
          {
            type: "triangle",
            volume: 0.13,
          },
        );
      },
    );
  }

  setMuted(muted) {
    this.muted = muted;

    if (
      !this.context ||
      !this.master
    ) {
      return;
    }

    const now =
      this.context.currentTime;

    this.master.gain.cancelScheduledValues(
      now,
    );

    this.master.gain.setTargetAtTime(
      muted
        ? 0.0001
        : 0.16,
      now,
      0.03,
    );
  }
}

const audio =
  new RetroAudio();

function seededRandom(seed) {
  let state =
    seed >>> 0;

  return () => {
    state =
      (
        state * 1664525 +
        1013904223
      ) >>> 0;

    return (
      state /
      4294967296
    );
  };
}

function shuffle(
  items,
  random,
) {
  const copy =
    [...items];

  for (
    let index =
      copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const target =
      Math.floor(
        random() *
          (index + 1),
      );

    [
      copy[index],
      copy[target],
    ] = [
      copy[target],
      copy[index],
    ];
  }

  return copy;
}

function createPuzzle() {
  const random =
    seededRandom(
      20260920,
    );

  const nextGrid =
    Array.from(
      {
        length:
          GRID_SIZE,
      },
      () =>
        Array(
          GRID_SIZE,
        ).fill(""),
    );

  const nextPlacements =
    [];

  const sortedWords =
    [...WORDS].sort(
      (a, b) =>
        b.key.length -
        a.key.length,
    );

  sortedWords.forEach(
    (word) => {
      const candidates =
        [];

      for (
        let row = 0;
        row < GRID_SIZE;
        row += 1
      ) {
        for (
          let col = 0;
          col < GRID_SIZE;
          col += 1
        ) {
          DIRECTIONS.forEach(
            (direction) => {
              const endRow =
                row +
                direction.row *
                  (
                    word.key.length -
                    1
                  );

              const endCol =
                col +
                direction.col *
                  (
                    word.key.length -
                    1
                  );

              if (
                endRow < 0 ||
                endRow >=
                  GRID_SIZE ||
                endCol < 0 ||
                endCol >=
                  GRID_SIZE
              ) {
                return;
              }

              let overlap = 0;
              let valid = true;

              for (
                let index = 0;
                index <
                word.key.length;
                index += 1
              ) {
                const targetRow =
                  row +
                  direction.row *
                    index;

                const targetCol =
                  col +
                  direction.col *
                    index;

                const current =
                  nextGrid[
                    targetRow
                  ][
                    targetCol
                  ];

                if (
                  current &&
                  current !==
                    word.key[
                      index
                    ]
                ) {
                  valid = false;
                }

                if (
                  current ===
                  word.key[
                    index
                  ]
                ) {
                  overlap += 1;
                }
              }

              if (valid) {
                candidates.push({
                  row,
                  col,
                  direction,
                  overlap,
                });
              }
            },
          );
        }
      }

      const shuffled =
        shuffle(
          candidates,
          random,
        ).sort(
          (a, b) =>
            b.overlap -
            a.overlap,
        );

      const selected =
        shuffled[0];

      if (!selected) {
        throw new Error(
          `No se pudo colocar la palabra ${word.key}`,
        );
      }

      const cells = [];

      for (
        let index = 0;
        index <
        word.key.length;
        index += 1
      ) {
        const row =
          selected.row +
          selected.direction.row *
            index;

        const col =
          selected.col +
          selected.direction.col *
            index;

        nextGrid[row][col] =
          word.key[index];

        cells.push({
          row,
          col,
        });
      }

      nextPlacements.push({
        ...word,
        cells,
      });
    },
  );

  for (
    let row = 0;
    row < GRID_SIZE;
    row += 1
  ) {
    for (
      let col = 0;
      col < GRID_SIZE;
      col += 1
    ) {
      if (
        !nextGrid[row][col]
      ) {
        nextGrid[row][col] =
          ALPHABET[
            Math.floor(
              random() *
                ALPHABET.length,
            )
          ];
      }
    }
  }

  grid = nextGrid;

  placements =
    nextPlacements;
}

function cellId(
  row,
  col,
) {
  return `${row}-${col}`;
}

function getCellElement(
  row,
  col,
) {
  return elements.grid.querySelector(
    `[data-cell="${cellId(
      row,
      col,
    )}"]`,
  );
}

function renderPuzzle() {
  elements.grid.innerHTML =
    "";

  grid.forEach(
    (
      rowValues,
      row,
    ) => {
      rowValues.forEach(
        (
          letter,
          col,
        ) => {
          const cell =
            document.createElement(
              "button",
            );

          cell.type =
            "button";

          cell.className =
            "letter-cell";

          cell.dataset.row =
            String(row);

          cell.dataset.col =
            String(col);

          cell.dataset.cell =
            cellId(
              row,
              col,
            );

          cell.setAttribute(
            "role",
            "gridcell",
          );

          cell.setAttribute(
            "aria-label",
            `Letra ${letter}, fila ${
              row + 1
            }, columna ${
              col + 1
            }`,
          );

          cell.textContent =
            letter;

          elements.grid.append(
            cell,
          );
        },
      );
    },
  );

  elements.wordList.innerHTML =
    "";

  WORDS.forEach(
    (word) => {
      const item =
        document.createElement(
          "li",
        );

      item.className =
        "word-item";

      item.dataset.word =
        word.key;

      item.textContent =
        word.label;

      elements.wordList.append(
        item,
      );
    },
  );
}

function getCoordinatesFromCell(
  cell,
) {
  return {
    row: Number(
      cell.dataset.row,
    ),
    col: Number(
      cell.dataset.col,
    ),
  };
}

function getLine(
  start,
  end,
) {
  const deltaRow =
    end.row -
    start.row;

  const deltaCol =
    end.col -
    start.col;

  if (
    deltaRow === 0 &&
    deltaCol === 0
  ) {
    return [start];
  }

  const isStraight =
    deltaRow === 0 ||
    deltaCol === 0 ||
    Math.abs(
      deltaRow,
    ) ===
      Math.abs(
        deltaCol,
      );

  if (!isStraight) {
    return [];
  }

  const length =
    Math.max(
      Math.abs(
        deltaRow,
      ),
      Math.abs(
        deltaCol,
      ),
    );

  const stepRow =
    Math.sign(
      deltaRow,
    );

  const stepCol =
    Math.sign(
      deltaCol,
    );

  return Array.from(
    {
      length:
        length + 1,
    },
    (
      _,
      index,
    ) => ({
      row:
        start.row +
        stepRow *
          index,

      col:
        start.col +
        stepCol *
          index,
    }),
  );
}

function clearSelection() {
  selectedCells.forEach(
    ({
      row,
      col,
    }) => {
      getCellElement(
        row,
        col,
      )?.classList.remove(
        "is-selected",
      );
    },
  );

  selectedCells = [];
}

function showSelection(
  cells,
) {
  clearSelection();

  selectedCells =
    cells;

  cells.forEach(
    ({
      row,
      col,
    }) => {
      getCellElement(
        row,
        col,
      )?.classList.add(
        "is-selected",
      );
    },
  );
}

function getWordFromCells(
  cells,
) {
  const forward =
    cells
      .map(
        ({
          row,
          col,
        }) =>
          grid[row][col],
      )
      .join("");

  const backward =
    [...forward]
      .reverse()
      .join("");

  return placements.find(
    (placement) =>
      !foundWords.has(
        placement.key,
      ) &&
      (
        placement.key ===
          forward ||
        placement.key ===
          backward
      ),
  );
}

function samePath(
  selected,
  placement,
) {
  if (
    selected.length !==
    placement.cells.length
  ) {
    return false;
  }

  const forward =
    selected.every(
      (
        cell,
        index,
      ) =>
        cell.row ===
          placement.cells[
            index
          ].row &&
        cell.col ===
          placement.cells[
            index
          ].col,
    );

  const reversed =
    selected.every(
      (
        cell,
        index,
      ) => {
        const target =
          placement.cells[
            placement
              .cells
              .length -
              1 -
              index
          ];

        return (
          cell.row ===
            target.row &&
          cell.col ===
            target.col
        );
      },
    );

  return (
    forward ||
    reversed
  );
}

function evaluateSelection(
  cells,
) {
  if (
    cells.length < 2
  ) {
    return false;
  }

  const possible =
    getWordFromCells(
      cells,
    );

  const placement =
    possible &&
    samePath(
      cells,
      possible,
    )
      ? possible
      : null;

  if (!placement) {
    const wrongCells =
      [...cells];

    clearSelection();

    wrongCells.forEach(
      ({
        row,
        col,
      }) =>
        getCellElement(
          row,
          col,
        )?.classList.add(
          "is-wrong",
        ),
    );

    elements.statusText.textContent =
      "Casi. Prueba en otra dirección.";

    audio.error();

    window.setTimeout(
      () => {
        wrongCells.forEach(
          ({
            row,
            col,
          }) =>
            getCellElement(
              row,
              col,
            )?.classList.remove(
              "is-wrong",
            ),
        );
      },
      370,
    );

    return false;
  }

  foundWords.add(
    placement.key,
  );

  clearSelection();

  placement.cells.forEach(
    ({
      row,
      col,
    }) =>
      getCellElement(
        row,
        col,
      )?.classList.add(
        "is-found",
      ),
  );

  elements.wordList
    .querySelector(
      `[data-word="${placement.key}"]`,
    )
    ?.classList.add(
      "is-found",
    );

  audio.success();

  updateProgress(
    placement.label,
  );

  return true;
}

function updateProgress(
  foundLabel,
) {
  const count =
    foundWords.size;

  const progress =
    (
      count /
      WORDS.length
    ) *
    100;

  elements.foundCount.textContent =
    String(count);

  elements.progressTrack.setAttribute(
    "aria-valuenow",
    String(count),
  );

  elements.progressFill.style.width =
    `${progress}%`;

  elements.statusText.textContent =
    `¡${foundLabel}! Sigue así.`;

  if (
    count ===
    WORDS.length
  ) {
    interactionLocked =
      true;

    elements.statusText.textContent =
      "¡Misión completada!";

    window.setTimeout(
      beginFinale,
      650,
    );
  }
}

function onPointerDown(
  event,
) {
  if (
    interactionLocked
  ) {
    return;
  }

  const cell =
    event.target.closest(
      ".letter-cell",
    );

  if (!cell) {
    return;
  }

  event.preventDefault();

  const current =
    getCoordinatesFromCell(
      cell,
    );

  const hadAnchor =
    Boolean(
      selectionAnchor,
    );

  dragState = {
    pointerId:
      event.pointerId,

    origin:
      selectionAnchor ||
      current,

    current,

    hadAnchor,

    moved: false,
  };

  if (!hadAnchor) {
    selectionAnchor =
      current;
  }

  showSelection(
    getLine(
      dragState.origin,
      current,
    ),
  );

  elements.grid.setPointerCapture?.(
    event.pointerId,
  );

  elements.statusText.textContent =
    hadAnchor
      ? "Toca la última letra."
      : "Arrastra o toca la última letra.";
}

function onPointerMove(
  event,
) {
  if (
    !dragState ||
    dragState.pointerId !==
      event.pointerId ||
    interactionLocked
  ) {
    return;
  }

  const element =
    document.elementFromPoint(
      event.clientX,
      event.clientY,
    );

  const cell =
    element?.closest?.(
      ".letter-cell",
    );

  if (
    !cell ||
    !elements.grid.contains(
      cell,
    )
  ) {
    return;
  }

  const current =
    getCoordinatesFromCell(
      cell,
    );

  if (
    current.row ===
      dragState.current.row &&
    current.col ===
      dragState.current.col
  ) {
    return;
  }

  dragState.current =
    current;

  dragState.moved =
    true;

  const line =
    getLine(
      dragState.origin,
      current,
    );

  if (line.length) {
    showSelection(
      line,
    );
  }
}

function onPointerUp(
  event,
) {
  if (
    !dragState ||
    dragState.pointerId !==
      event.pointerId ||
    interactionLocked
  ) {
    return;
  }

  const {
    origin,
    current,
    moved,
    hadAnchor,
  } = dragState;

  dragState = null;

  const shouldEvaluate =
    moved ||
    hadAnchor;

  if (shouldEvaluate) {
    const line =
      getLine(
        origin,
        current,
      );

    if (
      line.length > 1
    ) {
      evaluateSelection(
        line,
      );
    } else {
      clearSelection();

      elements.statusText.textContent =
        "La selección debe ir en línea recta.";
    }

    selectionAnchor =
      null;
  } else {
    showSelection(
      [origin],
    );

    selectionAnchor =
      origin;
  }
}

function onGridKeyDown(
  event,
) {
  if (
    interactionLocked ||
    ![
      "Enter",
      " ",
    ].includes(
      event.key,
    )
  ) {
    return;
  }

  const cell =
    event.target.closest(
      ".letter-cell",
    );

  if (!cell) {
    return;
  }

  event.preventDefault();

  const current =
    getCoordinatesFromCell(
      cell,
    );

  if (
    !selectionAnchor
  ) {
    selectionAnchor =
      current;

    showSelection(
      [current],
    );

    elements.statusText.textContent =
      "Ahora elige la última letra.";

    return;
  }

  const line =
    getLine(
      selectionAnchor,
      current,
    );

  if (
    line.length > 1
  ) {
    evaluateSelection(
      line,
    );
  } else {
    clearSelection();

    elements.statusText.textContent =
      "La selección debe ir en línea recta.";
  }

  selectionAnchor =
    null;
}

function spawnExplosion() {
  elements.explosionLayer.innerHTML =
    "";

  const cells =
    [
      ...elements.grid.querySelectorAll(
        ".letter-cell",
      ),
    ];

  const centerX =
    window.innerWidth /
    2;

  const centerY =
    window.innerHeight /
    2;

  cells.forEach(
    (
      cell,
      index,
    ) => {
      const rect =
        cell.getBoundingClientRect();

      if (
        index % 2 &&
        window.innerWidth <
          600
      ) {
        return;
      }

      const particle =
        document.createElement(
          "span",
        );

      particle.className =
        "letter-particle";

      particle.textContent =
        cell.textContent;

      particle.style.left =
        `${rect.left}px`;

      particle.style.top =
        `${rect.top}px`;

      particle.style.setProperty(
        "--particle-size",
        `${Math.max(
          18,
          rect.width,
        )}px`,
      );

      const angle =
        Math.atan2(
          rect.top -
            centerY,
          rect.left -
            centerX,
        ) +
        (
          Math.random() -
          0.5
        ) *
          0.8;

      const distance =
        170 +
        Math.random() *
          Math.max(
            window.innerWidth,
            window.innerHeight,
          ) *
          0.55;

      particle.style.setProperty(
        "--dx",
        `${Math.cos(
          angle,
        ) *
          distance}px`,
      );

      particle.style.setProperty(
        "--dy",
        `${Math.sin(
          angle,
        ) *
          distance}px`,
      );

      particle.style.setProperty(
        "--rotation",
        `${Math.round(
          (
            Math.random() -
            0.5
          ) *
            920,
        )}deg`,
      );

      particle.style.animationDelay =
        `${Math.random() * 0.12}s`;

      elements.explosionLayer.append(
        particle,
      );
    },
  );

  window.setTimeout(
    () => {
      elements.explosionLayer.innerHTML =
        "";
    },
    1600,
  );
}

function beginFinale() {
  audio.stopLoop();

  elements.gameShell.classList.add(
    "is-shaking",
  );

  if (
    navigator.vibrate
  ) {
    navigator.vibrate([
      90,
      45,
      120,
      45,
      180,
    ]);
  }

  window.setTimeout(
    () => {
      audio.explosion();

      spawnExplosion();

      elements.gameShell.classList.add(
        "is-vanishing",
      );
    },
    760,
  );

  window.setTimeout(
    showOutro,
    1240,
  );
}

function showOutro() {
  elements.gameShell.hidden =
    true;

  elements.gameShell.classList.remove(
    "is-shaking",
    "is-vanishing",
  );

  elements.outro.hidden =
    false;

  // Ocultamos la pregunta mientras están los créditos.
  if (
    elements.finalQuestion
  ) {
    elements.finalQuestion.hidden =
      true;
  }

  // Asegura que los créditos vuelvan a verse si se jugó antes.
  elements.crawl.style.display =
    "";

  // Reinicia la animación del crawl.
  elements.crawl.style.animation =
    "none";

  void elements.crawl.offsetWidth;

  elements.crawl.style.animation =
    "";

  audio.finale();

  // Esperamos a que terminen los créditos.
  replayTimer =
    window.setTimeout(
      () => {
        elements.crawl.style.display =
          "none";

        if (
          elements.finalQuestion
        ) {
          elements.finalQuestion.hidden =
            false;
        }

        elements.replayButton.classList.add(
          "is-visible",
        );
      },
      16000,
    );
}

function resetGame({
  keepScreen = true,
} = {}) {
  if (
    replayTimer
  ) {
    window.clearTimeout(
      replayTimer,
    );
  }

  replayTimer = null;

  foundWords =
    new Set();

  selectionAnchor =
    null;

  selectedCells =
    [];

  dragState =
    null;

  interactionLocked =
    false;

  elements.outro.hidden =
    true;

  // NUEVO: ocultamos la pregunta al reiniciar.
  if (
    elements.finalQuestion
  ) {
    elements.finalQuestion.hidden =
      true;
  }

  // NUEVO: hacemos que los créditos vuelvan a existir visualmente.
  elements.crawl.style.display =
    "";

  elements.replayButton.classList.remove(
    "is-visible",
  );

  elements.gameShell.hidden =
    !keepScreen;

  elements.gameShell.classList.remove(
    "is-shaking",
    "is-vanishing",
  );

  elements.foundCount.textContent =
    "0";

  elements.progressTrack.setAttribute(
    "aria-valuenow",
    "0",
  );

  elements.progressFill.style.width =
    "0%";

  elements.statusText.textContent =
    "Toca una letra para comenzar.";

  createPuzzle();

  renderPuzzle();

  audio.startTensionLoop();
}

async function startGame() {
  await audio.start();

  elements.startScreen.hidden =
    true;

  elements.gameShell.hidden =
    false;

  elements.totalCount.textContent =
    String(
      WORDS.length,
    );

  elements.progressTrack.setAttribute(
    "aria-valuemax",
    String(
      WORDS.length,
    ),
  );

  resetGame();
}

function toggleSound() {
  audio.setMuted(
    !audio.muted,
  );

  elements.soundButton.classList.toggle(
    "is-muted",
    audio.muted,
  );

  elements.soundButton.setAttribute(
    "aria-label",
    audio.muted
      ? "Activar música"
      : "Silenciar música",
  );

  elements.soundIcon.textContent =
    audio.muted
      ? "×"
      : "♪";
}

elements.startButton.addEventListener(
  "click",
  startGame,
);

elements.resetButton.addEventListener(
  "click",
  () =>
    resetGame(),
);

elements.replayButton.addEventListener(
  "click",
  () =>
    resetGame(),
);

elements.soundButton.addEventListener(
  "click",
  toggleSound,
);

elements.grid.addEventListener(
  "pointerdown",
  onPointerDown,
);

elements.grid.addEventListener(
  "pointermove",
  onPointerMove,
);

elements.grid.addEventListener(
  "pointerup",
  onPointerUp,
);

elements.grid.addEventListener(
  "keydown",
  onGridKeyDown,
);

elements.grid.addEventListener(
  "pointercancel",
  () => {
    dragState = null;
  },
);

createPuzzle();

renderPuzzle();
