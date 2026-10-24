import { useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import {
  IMPORT_FILE_ACCEPT,
  IMPORT_FORMAT_LABEL,
  IMPORT_LIMIT_LABEL,
  validateImportFile,
} from "../import-limits.js";

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
  initialType = "auto",
}) {
  const [selectedType, setSelectedType] = useState(initialType);
  const [error, setError] = useState("");
  const input = useRef(null);
  const busy = Boolean(progress);
  const upload = async (file) => {
    if (!file || busy) return;
    setError("");
    try {
      validateImportFile(file);
    } catch (error) {
      setError(error.message);
      return;
    }
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
        Importez un export texte délimité ou un classeur. Choisissez le type de
        données qu’il contient ; chaque source reste indépendante et locale.
      </p>
      <p className="privacy-note">
        Les années universitaires des dossiers étudiants sont conservées
        ensemble. Réimporter une même année actualise cette année. Sans année
        identifiée, le fichier remplace la source étudiante. Les exports d’avis
        et les synthèses remplacent leur version précédente, sans cumuler les
        doublons.
      </p>
      <div className="import-steps" aria-label="Étapes de l’import">
        <span>1 · Type de données</span>
        <span>2 · Vérification du fichier</span>
        <span>3 · Résultat et colonnes</span>
      </div>
      <fieldset disabled={busy} className="source-type-options">
        <legend>Que contient votre fichier ?</legend>
        {[
          {
            id: "auto",
            title: "Détection automatique",
            detail:
              "Reconnaît les avis, les dossiers étudiants et les synthèses à partir des colonnes.",
          },
          ...SOURCE_TYPES,
        ].map((type) => (
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
          if (event.dataTransfer.files.length !== 1) {
            setError("Ajoutez un seul fichier à la fois.");
            return;
          }
          void upload(event.dataTransfer.files[0]);
        }}
      >
        <p id="csv-format">
          <strong>{IMPORT_FORMAT_LABEL}</strong>
        </p>
        <p>Glissez votre fichier ici ou choisissez-le sur cet appareil.</p>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          aria-describedby="csv-format csv-platforms csv-limits csv-encoding"
          onClick={() => input.current.click()}
        >
          Choisir un fichier
        </button>
        <input
          ref={input}
          type="file"
          hidden
          tabIndex={-1}
          accept={IMPORT_FILE_ACCEPT}
          aria-label="Fichier à connecter"
          className="visually-hidden-input"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files[0]);
            event.target.value = "";
          }}
        />
        <small id="csv-platforms">
          Compatible avec Windows, macOS et Ubuntu.
        </small>
        <small id="csv-limits">{IMPORT_LIMIT_LABEL}</small>
        <small id="csv-encoding">
          Fichiers texte : UTF-8 (recommandé), Windows-1252 et UTF-16.
        </small>
      </div>
      <details className="csv-export-help">
        <summary>Comment préparer mon fichier ou mon classeur ?</summary>
        <p>
          Pour un classeur Excel ou LibreOffice, la première feuille visible
          contenant des données est importée. Son nom apparaît dans les sources.
          Placez la feuille souhaitée en premier ou exportez-la séparément (512
          colonnes maximum par feuille). Les dates et les montants restent des
          valeurs de données ; les formules ne sont pas exécutées et doivent
          avoir un résultat enregistré.
        </p>
        <p>
          Les fichiers CSV, TSV et TXT doivent contenir un tableau avec des
          en-têtes et des colonnes séparées par une virgule, un point-virgule ou
          une tabulation. Depuis Numbers, exportez en Excel ou CSV. Les PDF,
          images et documents texte non structurés ne sont pas pris en charge.
          Renommer l’extension ne convertit pas un fichier.
        </p>
      </details>
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
