import { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import { IMPORT_LIMIT_LABEL } from "../import-limits.js";

export const SOURCE_TYPES = [
  {
    id: "commercial",
    title: "Avis & activité commerciale",
    detail: "Retours, catégories, responsables, établissements et régions.",
  },
  {
    id: "students",
    title: "Dossiers étudiants",
    detail: "Étudiants, formations et montants individuels.",
  },
  {
    id: "schedule",
    title: "Échéancier des paiements",
    detail: "Échéances, montants prévus, règlements et retards.",
  },
  {
    id: "financial",
    title: "Synthèse financière",
    detail: "Agrégats mensuels ou fichier de paiements à associer.",
  },
  {
    id: "references",
    title: "Listes de référence",
    detail: "Formations, campus, modes de paiement et statuts.",
  },
];

export default function ImportDialog({
  open,
  onClose,
  onImport,
  progress,
  initialType = "commercial",
}) {
  const [selectedType, setSelectedType] = useState(initialType);
  const [error, setError] = useState("");
  const input = useRef(null);
  const busy = Boolean(progress);
  const upload = async (file) => {
    if (!file || busy) return;
    setError("");
    const result = await onImport(file, selectedType);
    if (result.ok) onClose();
    else
      setError(
        result.error || "Import impossible. Vérifiez les colonnes du fichier.",
      );
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Connecter une source"
      className="import-dialog"
    >
      <p>
        Choisissez le contenu du fichier. Chaque source reste indépendante et
        locale.
      </p>
      <div className="import-steps" aria-label="Étapes de l’import">
        <span>1 · Type de données</span>
        <span>2 · Vérification du CSV</span>
        <span>3 · Résultat et colonnes</span>
      </div>
      <fieldset disabled={busy} className="source-type-options">
        <legend>Que contient votre fichier ?</legend>
        {SOURCE_TYPES.map((type) => (
          <label
            key={type.id}
            className={selectedType === type.id ? "selected" : ""}
          >
            <input
              type="radio"
              name="source-type"
              value={type.id}
              checked={selectedType === type.id}
              onChange={() => setSelectedType(type.id)}
            />
            <span>
              <b>{type.title}</b>
              <small>{type.detail}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div
        className="import-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files[0]);
        }}
      >
        <p>Glissez votre CSV ici ou sélectionnez-le sur cet appareil.</p>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => input.current.click()}
        >
          Choisir un fichier CSV
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          aria-label="Fichier CSV à connecter"
          className="visually-hidden-input"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files[0]);
            event.target.value = "";
          }}
        />
        <small>{IMPORT_LIMIT_LABEL} · UTF-8, Windows-1252 ou UTF-16</small>
      </div>
      {progress && (
        <div className="import-progress" role="status">
          <progress aria-label="Import en cours" />
          <span>{progress.label}</span>
        </div>
      )}
      {error && (
        <p className="csv-import-error" role="alert">
          {error}
        </p>
      )}
      <p className="privacy-note">
        Les données sont conservées dans ce navigateur après l’import. Vous
        pourrez vérifier les colonnes, remplacer le fichier ou effacer les
        sources dans Sources & paramètres.
      </p>
    </Dialog>
  );
}
