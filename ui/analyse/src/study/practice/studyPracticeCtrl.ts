import * as xhr from '../studyXhr';
import { prop } from 'common';
import makeSuccess from './studyPracticeSuccess';
import makeSound from './sound';
import { readOnlyProp, enrichText } from '../../util';
import { StudyPracticeData, Goal, StudyPracticeCtrl } from './interfaces';
import { StudyData } from '../interfaces';
import AnalyseCtrl from '../../ctrl';

export default function(root: AnalyseCtrl, studyData: StudyData, data: StudyPracticeData): StudyPracticeCtrl {

  const goal = prop<Goal>(root.data.practiceGoal!),
  comment = prop<string | undefined>(undefined),
  nbMoves = prop(0),
  // null = ongoing, true = win, false = fail
  success = prop<boolean | null>(null),
  sound = makeSound(),
  analysisUrl = prop('');

  function makeComment(treeRoot: Tree.Node): string | undefined {
    if (!treeRoot.comments) return;
    const c = enrichText(treeRoot.comments[0].text, false);
    delete treeRoot.comments;
    return c;
  }

  function onLoad() {
    root.showAutoShapes = readOnlyProp(true);
    root.showGauge = readOnlyProp(true);
    root.showComputer = readOnlyProp(true);
    goal(root.data.practiceGoal!);
    nbMoves(0);
    success(null);
    comment(makeComment(root.tree.root));
    const chapter = studyData.chapter;
    history.replaceState(null, chapter.name, data.url + '/' + chapter.id);
    analysisUrl('/analysis/standard/' + root.node.fen.replace(/ /g, '_') + '?color=' + root.bottomColor());
  }
  onLoad();

  function computeNbMoves(): number {
    let plies = root.node.ply - root.tree.root.ply;
    if (root.bottomColor() !== root.data.player.color) plies--;
    return Math.ceil(plies / 2);
  }

  function checkSuccess(): void {
    if (success() !== null) return;
    nbMoves(computeNbMoves());
    const res = success(makeSuccess(root, goal(), nbMoves()));
    if (res) onVictory();
    else if (res === false) onFailure();
  }

  function onVictory(): void {
    const chapterId = root.study!.currentChapter().id,
    former = data.completion[chapterId] || 999;
    if (nbMoves() < former) {
      data.completion[chapterId] = nbMoves();
      xhr.practiceComplete(chapterId, nbMoves());
    }
    sound.success();
    const next = root.study!.nextChapter();
    if (next) setTimeout(() => root.study!.setChapter(next.id), 1000);
  }

  function onFailure(): void {
    root.node.fail = true;
    sound.failure();
  }

  return {
    onReload: onLoad,
    onJump() {
      // reset failure state if no failed move found in mainline history
      if (success() === false && !root.nodeList.find(n => !!n.fail)) success(null);
      checkSuccess();
    },
    onCeval: checkSuccess,
    data,
    goal,
    success,
    comment,
    nbMoves,
    reset() {
      root.tree.root.children = [];
      root.userJump('');
      root.practice!.reset();
      onLoad();
    },
    isWhite() {
      return root.bottomColor() === 'white';
    },
    analysisUrl
  };
}
