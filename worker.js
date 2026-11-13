importScripts('engine.js');
self.onmessage = function (e) {
  var r = self.SudokuEngine.generate(e.data.level, e.data.seed);
  self.postMessage({ puzzle: r.puzzle, solution: r.solution, level: r.level, clues: r.clues, rank: r.grade.maxRank });
};
