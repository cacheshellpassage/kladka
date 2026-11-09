/** First-run introduction: three short slides, shown once (skipped in automated browsers). */
import { useState } from "react";
import { useT, type MessageKey } from "../i18n";
import { useSettings } from "../store/settings";
import { Modal } from "./Common";
import { Icon } from "./Icon";
import { Cubes } from "./Visual";

const SLIDES: Array<{ icon: string | null; title: MessageKey; text: MessageKey }> = [
  { icon: null, title: "onboard.1.title", text: "onboard.1.text" },
  { icon: "cube", title: "onboard.2.title", text: "onboard.2.text" },
  { icon: "import", title: "onboard.3.title", text: "onboard.3.text" },
];

export function Onboarding() {
  const t = useT();
  const done = useSettings((s) => s.onboarded);
  const set = useSettings((s) => s.set);
  const [i, setI] = useState(0);
  if (done || (typeof navigator !== "undefined" && navigator.webdriver)) return null;
  const close = () => set({ onboarded: true });
  const s = SLIDES[i]!;
  const last = i === SLIDES.length - 1;
  return (
    <Modal title={t("onboard.title")} onClose={close}>
      <div className="onboard">
        <div className="slide" key={i}>
          <div className="art">
            {s.icon ? (
              <span
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 28,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--grad-accent)",
                  color: "#fff",
                  boxShadow: "var(--glow)",
                }}
              >
                <Icon name={s.icon} size={48} />
              </span>
            ) : (
              <Cubes style={{ width: 130, height: 130 }} />
            )}
          </div>
          <h2>{t(s.title)}</h2>
          <p className="muted">{t(s.text)}</p>
        </div>
        <div className="dots" aria-hidden="true">
          {SLIDES.map((_, k) => (
            <i key={k} className={k === i ? "on" : ""} />
          ))}
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          {!last ? (
            <button className="btn ghost" type="button" onClick={close}>
              {t("onboard.skip")}
            </button>
          ) : null}
          <button className="btn primary big" type="button" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? t("onboard.start") : t("onboard.next")} <Icon name={last ? "check" : "next"} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
