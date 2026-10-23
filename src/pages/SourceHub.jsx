import { useState } from "react";
import { PageTitle, Icon } from "../components/Ui.jsx";
import { SOURCE_TYPES } from "../components/ImportDialog.jsx";
import { TUITION_SOURCE_FIELDS } from "../tuition-data.js";

const destinations = {
  commercial: "feedback",
  financial: "revenue",
  students: "students",
  schedule: "schedule",
  references: "data-sources",
};
const friendlyStatus = (source) =>
  !source
    ? "À connecter"
    : source.quality?.status === "incomplete"
      ? "À vérifier"
      : "Importé";
const fmtDate = (date) =>
  date
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "Date non disponible — réimportez pour l’enregistrer";

export default function SourceHub({
  sources,
  commercialSource,
  financialSource,
  errors,
  commercialError,
  financialError,
  onMapping,
  onImportType,
  onNavigate,
  onClearSaved,
  settings,
  setSettings,
  storageStatus,
}) {
  const [confirmation, setConfirmation] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const records = {
    commercial: commercialSource,
    financial: financialSource,
    ...sources,
  };
  const allErrors = {
    ...errors,
    commercial: commercialError,
    financial: financialError,
  };
  const connected = Object.values(records).filter(Boolean).length;
  return (
    <>
      <PageTitle
        eyebrow="VOTRE ESPACE LOCAL"
        title="Sources & paramètres"
        subtitle="Avis, activité et finances : un point de contrôle pour tous vos fichiers."
        badge={`${connected} / 5 sources importées`}
      />
      <section className="workspace-intro">
        <Icon name="shield" />
        <div>
          <h2>Vos données restent sur cet appareil</h2>
          <p>
            Les fichiers sont enregistrés dans ce navigateur. Ils ne sont pas
            partagés avec d’autres utilisateurs ni synchronisés entre appareils.
            Effacer les données du navigateur supprime aussi les imports.
          </p>
          <small>
            {storageStatus === "unavailable"
              ? "Attention : conservation locale indisponible. Gardez vos CSV d’origine."
              : "Conservez les CSV d’origine comme sauvegarde et réimportez-les pour restaurer votre espace."}
          </small>
        </div>
      </section>
      <div className="source-hub-grid">
        {SOURCE_TYPES.map((type) => {
          const source = records[type.id];
          const count = source?.rowCount ?? source?.rows?.length ?? 0;
          return (
            <article className="source-hub-card" key={type.id}>
              <div className="source-card-heading">
                <span className={`source-pill ${source ? "ready" : "missing"}`}>
                  {friendlyStatus(source)}
                </span>
                <Icon
                  name={
                    type.id === "financial" || type.id === "schedule"
                      ? "euro"
                      : "total"
                  }
                />
              </div>
              <h2>{type.title}</h2>
              <p>{type.detail}</p>
              {source ? (
                <dl>
                  <dt>Fichier</dt>
                  <dd>{source.fileName}</dd>
                  <dt>Lignes</dt>
                  <dd>{count.toLocaleString("fr-FR")}</dd>
                  <dt>Dernier import</dt>
                  <dd>{fmtDate(source.importedAt)}</dd>
                  {source.invalidDates > 0 && (
                    <>
                      <dt>Dates à vérifier</dt>
                      <dd>{source.invalidDates}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="source-empty-copy">
                  Connectez un CSV pour activer cette rubrique.
                </p>
              )}
              {allErrors[type.id] && (
                <p role="alert" className="csv-import-error">
                  {allErrors[type.id]}
                </p>
              )}
              <div className="source-card-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onImportType(type.id)}
                >
                  {source ? "Remplacer le fichier" : "Connecter un fichier"}
                </button>
                {source && type.id !== "references" && (
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => onNavigate(destinations[type.id])}
                  >
                    Voir les données
                  </button>
                )}
              </div>
              {source &&
                ["students", "schedule", "references"].includes(type.id) && (
                  <details className="tuition-mapping">
                    <summary>Colonnes et contrôles de qualité</summary>
                    <p>
                      Associez uniquement les colonnes dont le sens est confirmé
                      dans votre fichier.
                    </p>
                    <div className="financial-mapping-grid">
                      {TUITION_SOURCE_FIELDS[type.id].map(([key, label]) => (
                        <label className="financial-mapping-field" key={key}>
                          <span>{label}</span>
                          <select
                            value={source.mapping?.[key] ?? ""}
                            onChange={(event) =>
                              onMapping(type.id, {
                                ...source.mapping,
                                [key]: event.target.value,
                              })
                            }
                          >
                            <option value="">Non associée</option>
                            {source.headers.map((header) => (
                              <option key={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
            </article>
          );
        })}
      </div>
      <section className="settings-card">
        <h2>Présentation des montants</h2>
        <p>
          Choisissez la devise confirmée des fichiers financiers. Ce réglage
          ajoute une unité, sans convertir les montants.
        </p>
        <label>
          Devise des fichiers financiers
          <select
            aria-label="Devise des fichiers financiers"
            value={settings.currency}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                currency: event.target.value,
              }))
            }
          >
            <option value="">Non confirmée</option>
            <option value="TND">TND — Dinar tunisien</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar américain</option>
          </select>
        </label>
        <p className="settings-note">
          Si vos fichiers utilisent plusieurs devises, préparez un export
          homogène avant de les analyser ensemble.
        </p>
      </section>
      <section className="settings-card">
        <h2>Validation avant utilisation des résultats</h2>
        <p>
          Les contrôles techniques ne remplacent pas la confirmation du
          responsable des données.
        </p>
        <label className="checkbox-setting">
          <input
            type="checkbox"
            checked={settings.definitionsReviewed}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                definitionsReviewed: event.target.checked,
              }))
            }
          />
          J’ai confirmé la signification des statuts, les identifiants uniques
          et le périmètre des fichiers.
        </label>
        <label className="checkbox-setting">
          <input
            type="checkbox"
            checked={settings.totalsReviewed}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                totalsReviewed: event.target.checked,
              }))
            }
          />
          J’ai rapproché les totaux affichés avec les exports d’origine.
        </label>
        <p role="status">
          {settings.definitionsReviewed &&
          settings.totalsReviewed &&
          settings.currency
            ? "Contrôles déclarés effectués sur cet appareil."
            : "Validation métier à terminer avant de s’appuyer sur les résultats financiers."}
        </p>
      </section>
      <section className="settings-card">
        <h2>Effacer les imports locaux</h2>
        <p>
          Supprime tous les fichiers importés de ce navigateur. Vos fichiers CSV
          d’origine restent sur votre ordinateur.
        </p>
        <label className="checkbox-setting">
          <input
            type="checkbox"
            checked={confirmation}
            onChange={(event) => setConfirmation(event.target.checked)}
          />
          Je souhaite effacer les imports enregistrés.
        </label>
        <button
          type="button"
          className="outline-button danger-button"
          disabled={!confirmation || clearing || storageStatus === "loading"}
          onClick={async () => {
            setClearing(true);
            setCleared(false);
            setDeleteError(false);
            const ok = await onClearSaved();
            setClearing(false);
            setCleared(ok);
            setDeleteError(!ok);
            if (ok) setConfirmation(false);
          }}
        >
          {clearing
            ? "Suppression en cours…"
            : "Effacer les imports enregistrés"}
        </button>
        {deleteError && (
          <p role="alert">
            Suppression impossible. Les imports restent visibles ; vérifiez le
            stockage du navigateur puis réessayez.
          </p>
        )}
        {cleared && (
          <p role="status">Les imports ont été supprimés de cet appareil.</p>
        )}
      </section>
    </>
  );
}
