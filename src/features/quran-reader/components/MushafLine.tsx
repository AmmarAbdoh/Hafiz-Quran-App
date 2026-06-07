import { useMemo, useRef } from "react";

import { MushafLineAyahHighlight } from "@/features/quran-reader/components/MushafLineAyahHighlight";

import { MushafWord } from "@/features/quran-reader/components/MushafWord";

import { cn } from "@/shared/lib/utils";

import type { VerseSelection } from "@/features/quran-reader/types/selection";

import type { MushafWord as MushafWordType } from "@/shared/types/quran";



function groupWordsIntoAyahRuns(words: MushafWordType[]): MushafWordType[][] {

  const runs: MushafWordType[][] = [];



  for (const word of words) {

    const lastRun = runs[runs.length - 1];

    if (lastRun && lastRun[0]?.verse_key === word.verse_key) {

      lastRun.push(word);

    } else {

      runs.push([word]);

    }

  }



  return runs;

}



function groupWordsForSpread(words: MushafWordType[]): MushafWordType[][] {

  const groups: MushafWordType[][] = [];



  for (const word of words) {

    if (word.char_type === "end" && groups.length > 0) {

      groups[groups.length - 1]!.push(word);

    } else {

      groups.push([word]);

    }

  }



  return groups;

}



interface MushafLineProps {

  lineNumber: number;

  words: MushafWordType[];

  spreadLayout: boolean;

  fontFamily: string;

  fontPalette?: string;

  fontReady: boolean;

  colored: boolean;

  selection: VerseSelection | null;

  highlightVerseKey: string | null;

  recitationVerseKey: string | null;

  recitationWordLocation: string | null;

  practiceMode?: boolean;

  practiceHideAyat?: boolean;

  practiceRevealedLocations?: string[];

  practiceTargetWordLocation?: string | null;

  practiceWrongFlashLocation?: string | null;

  onWordActivate?: (

    word: MushafWordType,

    event: React.MouseEvent<HTMLElement>,

  ) => void;

}



export function MushafLine({

  lineNumber,

  words,

  spreadLayout,

  fontFamily,

  fontPalette,

  fontReady,

  colored,

  selection,

  highlightVerseKey,

  recitationVerseKey,

  recitationWordLocation,

  practiceMode = false,

  practiceHideAyat = false,

  practiceRevealedLocations = [],

  practiceTargetWordLocation = null,

  practiceWrongFlashLocation = null,

  onWordActivate,

}: MushafLineProps) {

  const lineContentRef = useRef<HTMLDivElement>(null);



  const revealedSet = useMemo(

    () => new Set(practiceRevealedLocations),

    [practiceRevealedLocations],

  );

  const wordZIndexByLocation = new Map(

    words.map((word, index) => [word.location, words.length - index + 1]),

  );



  const activeAyahKey =
    highlightVerseKey ??
    (selection?.mode === "ayah"
      ? selection.verseKey
      : recitationVerseKey);



  const lineHasActiveAyah =

    Boolean(activeAyahKey) &&

    words.some((word) => word.verse_key === activeAyahKey);



  const lineHasRecitingWord =

    Boolean(recitationWordLocation) &&

    words.some((word) => word.location === recitationWordLocation);



  const showAyahOverlay =

    fontReady && (lineHasActiveAyah || lineHasRecitingWord);



  const renderWord = (word: MushafWordType) => {

    const isWordSelected =

      selection?.mode === "word" &&

      selection.word.location === word.location;

    const isPracticeTarget =

      practiceMode &&

      word.char_type !== "end" &&

      practiceTargetWordLocation === word.location;

    const practiceWrongFlash =

      practiceMode && practiceWrongFlashLocation === word.location;

    const practiceHidden =

      practiceMode &&

      practiceHideAyat &&

      word.char_type !== "end" &&

      !revealedSet.has(word.location);



    return (

      <MushafWord

        key={word.location}

        word={word}

        fontFamily={fontFamily}

        fontPalette={fontPalette}

        fontReady={fontReady}

        colored={colored}

        isWordSelected={isWordSelected}

        isPracticeTarget={isPracticeTarget}

        practiceHidden={practiceHidden}

        practiceWrongFlash={practiceWrongFlash}

        wordZIndex={wordZIndexByLocation.get(word.location)}

        onWordActivate={onWordActivate}

      />

    );

  };



  return (

    <div

      className={cn(

        "mushaf-line",

        spreadLayout && "mushaf-line--full mushaf-line--spread",

      )}

      data-line={lineNumber}

      style={spreadLayout ? { zIndex: 16 - lineNumber } : undefined}

    >

      <div

        ref={lineContentRef}

        className={cn(

          spreadLayout ? "mushaf-line__verse" : "mushaf-line__content",

        )}

      >

        {showAyahOverlay ? (

          <MushafLineAyahHighlight

            containerRef={lineContentRef}

            verseKey={lineHasActiveAyah ? activeAyahKey : null}

            recitationWordLocation={

              lineHasRecitingWord ? recitationWordLocation : null

            }

            pulse={Boolean(

              highlightVerseKey &&

                lineHasActiveAyah &&

                highlightVerseKey === activeAyahKey,

            )}

            enabled={showAyahOverlay}

          />

        ) : null}



        {spreadLayout ? (

          groupWordsIntoAyahRuns(words).map((run) => (

            <span

              key={run.map((word) => word.location).join("-")}

              className="mushaf-ayah-run"

              data-verse-key={run[0]?.verse_key ?? ""}

            >

              {groupWordsForSpread(run).map((group) => (

                <span

                  key={group.map((word) => word.location).join("-")}

                  className="mushaf-word-group"

                >

                  {group.map(renderWord)}

                </span>

              ))}

            </span>

          ))

        ) : (

          words.map(renderWord)

        )}

      </div>

    </div>

  );

}

