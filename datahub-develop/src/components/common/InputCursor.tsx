// 깜빡이는 입력 커서 — 인라인 편집 표의 빈 셀에 표시. CSS 애니메이션은 globals.css 의
//   .input-cursor / @keyframes input-cursor-blink 에 정의(여기서 재정의하지 않음).
//   '+ 클릭해서 입력' 텍스트를 대체해 빈 셀이 곧 input 처럼 보이게 한다.

export function InputCursor() {
  return <span className="input-cursor" aria-hidden="true" />;
}
