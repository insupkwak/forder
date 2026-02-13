(function () {
  const $ = (id) => document.getElementById(id);

  const kpiScore = $("kpiScore");
  const kpiCorrect = $("kpiCorrect");
  const kpiWrong = $("kpiWrong");

  const qTitle = $("qTitle");
  const qFlag = $("qFlag");
  const qHint = $("qHint");
  const choicesEl = $("choices");

  const nextBtn = $("nextBtn");
  const resetBtn = $("resetBtn");
  const resultText = $("resultText");

  // 국기는 이모지로 표시

 const DATA = [
  { country: "대한민국", capital: "서울", code: "kr" },
  { country: "일본", capital: "도쿄", code: "jp" },
  { country: "중국", capital: "베이징", code: "cn" },
  { country: "미국", capital: "워싱턴 D.C.", code: "us" },
  { country: "영국", capital: "런던", code: "gb" },
  { country: "프랑스", capital: "파리", code: "fr" },
  { country: "독일", capital: "베를린", code: "de" },
  { country: "이탈리아", capital: "로마", code: "it" },
  { country: "스페인", capital: "마드리드", code: "es" },
  { country: "캐나다", capital: "오타와", code: "ca" },
  { country: "호주", capital: "캔버라", code: "au" },
  { country: "브라질", capital: "브라질리아", code: "br" },
  { country: "멕시코", capital: "멕시코시티", code: "mx" },
  { country: "인도", capital: "뉴델리", code: "in" },
  { country: "태국", capital: "방콕", code: "th" },
  { country: "베트남", capital: "하노이", code: "vn" },
  { country: "싱가포르", capital: "싱가포르", code: "sg" },
  { country: "터키", capital: "앙카라", code: "tr" },
  { country: "이집트", capital: "카이로", code: "eg" },
  { country: "남아프리카공화국", capital: "프리토리아", code: "za" },

  { country: "아르헨티나", capital: "부에노스아이레스", code: "ar" },
  { country: "칠레", capital: "산티아고", code: "cl" },
  { country: "콜롬비아", capital: "보고타", code: "co" },
  { country: "페루", capital: "리마", code: "pe" },
  { country: "베네수엘라", capital: "카라카스", code: "ve" },
  { country: "우루과이", capital: "몬테비데오", code: "uy" },
  { country: "파라과이", capital: "아순시온", code: "py" },
  { country: "볼리비아", capital: "수크레", code: "bo" },

  { country: "스위스", capital: "베른", code: "ch" },
  { country: "네덜란드", capital: "암스테르담", code: "nl" },
  { country: "벨기에", capital: "브뤼셀", code: "be" },
  { country: "오스트리아", capital: "빈", code: "at" },
  { country: "포르투갈", capital: "리스본", code: "pt" },
  { country: "그리스", capital: "아테네", code: "gr" },
  { country: "폴란드", capital: "바르샤바", code: "pl" },
  { country: "체코", capital: "프라하", code: "cz" },
  { country: "헝가리", capital: "부다페스트", code: "hu" },
  { country: "덴마크", capital: "코펜하겐", code: "dk" },
  { country: "노르웨이", capital: "오슬로", code: "no" },
  { country: "스웨덴", capital: "스톡홀름", code: "se" },
  { country: "핀란드", capital: "헬싱키", code: "fi" },
  { country: "아일랜드", capital: "더블린", code: "ie" },
  { country: "루마니아", capital: "부쿠레슈티", code: "ro" },
  { country: "불가리아", capital: "소피아", code: "bg" },

  { country: "러시아", capital: "모스크바", code: "ru" },
  { country: "우크라이나", capital: "키이우", code: "ua" },
  { country: "벨라루스", capital: "민스크", code: "by" },
  { country: "크로아티아", capital: "자그레브", code: "hr" },
  { country: "슬로바키아", capital: "브라티슬라바", code: "sk" },
  { country: "슬로베니아", capital: "류블랴나", code: "si" },
  { country: "에스토니아", capital: "탈린", code: "ee" },
  { country: "라트비아", capital: "리가", code: "lv" },
  { country: "리투아니아", capital: "빌뉴스", code: "lt" },
  { country: "아이슬란드", capital: "레이캬비크", code: "is" },
    { country: "카자흐스탄", capital: "아스타나", code: "kz" },
  { country: "우즈베키스탄", capital: "타슈켄트", code: "uz" },
  { country: "투르크메니스탄", capital: "아시가바트", code: "tm" },
  { country: "키르기스스탄", capital: "비슈케크", code: "kg" },
  { country: "타지키스탄", capital: "두샨베", code: "tj" },

  { country: "아프가니스탄", capital: "카불", code: "af" },
  { country: "시리아", capital: "다마스쿠스", code: "sy" },
  { country: "레바논", capital: "베이루트", code: "lb" },
  { country: "오만", capital: "무스카트", code: "om" },
  { country: "예멘", capital: "사나", code: "ye" },

  { country: "뉴질랜드", capital: "웰링턴", code: "nz" },
  { country: "피지", capital: "수바", code: "fj" },
  { country: "파푸아뉴기니", capital: "포트모르즈비", code: "pg" },

  { country: "탄자니아", capital: "도도마", code: "tz" },
  { country: "우간다", capital: "캄팔라", code: "ug" },
  { country: "잠비아", capital: "루사카", code: "zm" },
  { country: "짐바브웨", capital: "하라레", code: "zw" },
  { country: "세네갈", capital: "다카르", code: "sn" },
  { country: "코트디부아르", capital: "야무수크로", code: "ci" },
  { country: "카메룬", capital: "야운데", code: "cm" },

  { country: "가봉", capital: "리브르빌", code: "ga" },
  { country: "콩고공화국", capital: "브라자빌", code: "cg" },
  { country: "콩고민주공화국", capital: "킨샤사", code: "cd" },
  { country: "모잠비크", capital: "마푸토", code: "mz" },
  { country: "마다가스카르", capital: "안타나나리보", code: "mg" },

  { country: "과테말라", capital: "과테말라시티", code: "gt" },
  { country: "쿠바", capital: "아바나", code: "cu" },
  { country: "도미니카공화국", capital: "산토도밍고", code: "do" },
  { country: "파나마", capital: "파나마시티", code: "pa" },
  { country: "코스타리카", capital: "산호세", code: "cr" },
    { country: "룩셈부르크", capital: "룩셈부르크", code: "lu" },
  { country: "몰타", capital: "발레타", code: "mt" },
  { country: "키프로스", capital: "니코시아", code: "cy" },
  { country: "알바니아", capital: "티라나", code: "al" },
  { country: "북마케도니아", capital: "스코페", code: "mk" },
  { country: "보스니아헤르체고비나", capital: "사라예보", code: "ba" },
  { country: "세르비아", capital: "베오그라드", code: "rs" },
  { country: "몬테네그로", capital: "포드고리차", code: "me" },
  { country: "몰도바", capital: "키시너우", code: "md" },
  { country: "조지아", capital: "트빌리시", code: "ge" },

  { country: "아르메니아", capital: "예레반", code: "am" },
  { country: "아제르바이잔", capital: "바쿠", code: "az" },
  { country: "몰디브", capital: "말레", code: "mv" },
  { country: "부탄", capital: "팀푸", code: "bt" },
  { country: "브루나이", capital: "반다르스리브가완", code: "bn" },
  { country: "동티모르", capital: "딜리", code: "tl" },

  { country: "르완다", capital: "키갈리", code: "rw" },
  { country: "부룬디", capital: "기테가", code: "bi" },
  { country: "말라위", capital: "릴롱궤", code: "mw" },
  { country: "보츠와나", capital: "가보로네", code: "bw" },
  { country: "나미비아", capital: "빈트후크", code: "na" },
  { country: "레소토", capital: "마세루", code: "ls" },
  { country: "에스와티니", capital: "음바바네", code: "sz" },

  { country: "에콰도르", capital: "키토", code: "ec" },
  { country: "엘살바도르", capital: "산살바도르", code: "sv" },
  { country: "온두라스", capital: "테구시갈파", code: "hn" },
  { country: "니카라과", capital: "마나과", code: "ni" },
  { country: "아이티", capital: "포르토프랭스", code: "ht" },
  { country: "자메이카", capital: "킹스턴", code: "jm" },
  { country: "바하마", capital: "나소", code: "bs" },
    { country: "안도라", capital: "안도라라베야", code: "ad" },
  { country: "모나코", capital: "모나코", code: "mc" },
  { country: "산마리노", capital: "산마리노", code: "sm" },
  { country: "바티칸시국", capital: "바티칸시국", code: "va" },
  { country: "리히텐슈타인", capital: "파두츠", code: "li" },

  { country: "기니", capital: "코나크리", code: "gn" },
  { country: "기니비사우", capital: "비사우", code: "gw" },
  { country: "시에라리온", capital: "프리타운", code: "sl" },
  { country: "라이베리아", capital: "몬로비아", code: "lr" },
  { country: "토고", capital: "로메", code: "tg" },
  { country: "베냉", capital: "포르토노보", code: "bj" },
  { country: "부르키나파소", capital: "와가두구", code: "bf" },
  { country: "니제르", capital: "니아메", code: "ne" },
  { country: "차드", capital: "은자메나", code: "td" },
  { country: "중앙아프리카공화국", capital: "방기", code: "cf" },

  { country: "소말리아", capital: "모가디슈", code: "so" },
  { country: "지부티", capital: "지부티", code: "dj" },
  { country: "에리트레아", capital: "아스마라", code: "er" },
  { country: "수단", capital: "하르툼", code: "sd" },
  { country: "남수단", capital: "주바", code: "ss" },

  { country: "앙티가바부다", capital: "세인트존스", code: "ag" },
  { country: "바베이도스", capital: "브리지타운", code: "bb" },
  { country: "벨리즈", capital: "벨모판", code: "bz" },
  { country: "그레나다", capital: "세인트조지스", code: "gd" },
  { country: "가이아나", capital: "조지타운", code: "gy" },
  { country: "수리남", capital: "파라마리보", code: "sr" },
  { country: "트리니다드토바고", capital: "포트오브스페인", code: "tt" },

  { country: "키리바시", capital: "타라와", code: "ki" },
  { country: "사모아", capital: "아피아", code: "ws" },
  { country: "통가", capital: "누쿠알로파", code: "to" },
  { country: "바누아투", capital: "포트빌라", code: "vu" },
  { country: "솔로몬제도", capital: "호니아라", code: "sb" },
  { country: "마셜제도", capital: "마주로", code: "mh" },
  { country: "미크로네시아", capital: "팔리키르", code: "fm" },
  { country: "팔라우", capital: "응게룰무드", code: "pw" },

  { country: "코모로", capital: "모로니", code: "km" },
  { country: "세이셸", capital: "빅토리아", code: "sc" },
  { country: "모리셔스", capital: "포트루이스", code: "mu" },

  { country: "도미니카", capital: "로조", code: "dm" },
  { country: "세인트루시아", capital: "캐스트리스", code: "lc" },
  { country: "세인트빈센트그레나딘", capital: "킹스타운", code: "vc" },
  { country: "세인트키츠네비스", capital: "바스테르", code: "kn" },

  { country: "적도기니", capital: "말라보", code: "gq" },
  { country: "상투메프린시페", capital: "상투메", code: "st" },
  { country: "카보베르데", capital: "프라이아", code: "cv" },

  { country: "부탄", capital: "팀푸", code: "bt" },
  { country: "브루나이", capital: "반다르스리브가완", code: "bn" },


  

];




  let score = 0;
  let correct = 0;
  let wrong = 0;

  let locked = false;
  let deck = [];        // 셔플된 문제 덱(중복 없음)
  let idx = 0;          // 현재 문제 인덱스
  let current = null;   // 현재 문제
  let autoTimer = null; // 자동 다음 타이머

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

const QUESTION_LIMIT = 20;   // 출제 문제 수

function buildDeck() {
  deck = shuffle(DATA).slice(0, QUESTION_LIMIT);
  idx = 0;
}


  function makeChoices(q) {
    const wrongPool = DATA
      .filter((x) => x.capital !== q.capital)
      .map((x) => x.capital);

    const wrongs = shuffle(wrongPool).slice(0, 3);
    return shuffle([q.capital, ...wrongs]);
  }

  function updateKPI() {
    kpiScore.textContent = String(score);
    kpiCorrect.textContent = String(correct);
    kpiWrong.textContent = String(wrong);
  }

  function clearTimer() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function showComplete() {
    locked = true;
    choicesEl.innerHTML = "";

    qTitle.textContent = "완료";
      
    qHint.textContent = `모든 문제를 풀었습니다. (총 20 문제)`;

    resultText.classList.remove("ok", "no");
    resultText.textContent = `최종 점수 ${score}점 (정답 ${correct} / 오답 ${wrong})`;
  }

  function loadQuestion() {
    clearTimer();

    // 덱을 전부 풀었으면 완료
    if (idx >= deck.length) {
      showComplete();
      return;
    }

    current = deck[idx];
    const choices = makeChoices(current);

    updateKPI();

    qTitle.textContent = `나라: ${current.country}`;
   qFlag.innerHTML = `
  <img 
    src="https://flagcdn.com/w80/${current.code}.png" 
    alt="${current.country}" 
    class="flag-img"
  />
`;

    qHint.textContent = `아래 보기 중 수도를 고르세요. (${idx + 1}/${deck.length})`;

    resultText.classList.remove("ok", "no");
    resultText.textContent = "";
    locked = false;

    choicesEl.innerHTML = "";
    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = choice;
      btn.addEventListener("click", () => onChoose(choice));
      choicesEl.appendChild(btn);
    });
  }

  function goNextAuto() {
    // 0.8초 후 자동 다음
    autoTimer = setTimeout(() => {
      idx += 1;
      loadQuestion();
    }, 800);
  }

  function onChoose(choice) {
    if (locked) return;
    locked = true;

    const isCorrect = choice === current.capital;

    resultText.classList.remove("ok", "no");

    if (isCorrect) {
      score += 10;
      correct += 1;
      resultText.textContent = "정답입니다. +10점";
      resultText.classList.add("ok");
    } else {
      score = Math.max(0, score - 5);
      wrong += 1;
      resultText.textContent = `오답입니다. 정답: ${current.capital} (-5점)`;
      resultText.classList.add("no");
    }

    updateKPI();
    goNextAuto();
  }

  // 다음 문제 버튼: 즉시 다음으로 넘어가기(자동 타이머도 취소)
  function next() {
    clearTimer();
    idx += 1;
    loadQuestion();
  }

  // 초기화: 점수 리셋 + 덱 새로 생성
  function reset() {
    clearTimer();
    score = 0;
    correct = 0;
    wrong = 0;
    buildDeck();
    loadQuestion();
  }

  nextBtn.addEventListener("click", next);
  resetBtn.addEventListener("click", reset);

  // 시작
  reset();
})();
