import type { AppInfo } from "../lib/backend";
import type { MessageKey } from "../i18n/messages";

interface Props {
  t: (key: MessageKey) => string;
  info: AppInfo | null;
}

export default function Today({ t, info }: Props) {
  return (
    <>
      <h1 className="title">{t("todayTitle")}</h1>
      <div className="cards">
        <section className="card" aria-labelledby="phase">
          <h2 id="phase">{t("phaseTitle")}</h2>
          <p className="muted">{t("phaseBody")}</p>
          <dl className="rows">
            <dt>{t("version")}</dt>
            <dd>{info?.version ?? "—"}</dd>
            <dt>{t("runtime")}</dt>
            <dd>{info ? t("runtimeDesktop") : t("runtimeBrowser")}</dd>
          </dl>
        </section>
        <section className="card" aria-labelledby="hardware">
          <h2 id="hardware">{t("hardwareTitle")}</h2>
          <p>
            <span className="badge">{t("hardwareNotVerified")}</span>
          </p>
        </section>
      </div>
    </>
  );
}
