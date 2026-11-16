import { useEffect, useRef, useState } from "react";
import {
  ArrowUpFromLine,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  FileImage,
  FileText,
  LoaderCircle,
  Play,
  ScanText,
  X,
} from "lucide-react";
import { recognizeImage, type ParsedQuestion, type OCRResponse } from "./api";
import { parseQuestion } from "./questionParser";
import { buildQuestionWorkbook } from "./workbook";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_QUEUE_SIZE = 500;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type QueueStatus = "queued" | "processing" | "completed" | "failed";

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  result: OCRResponse | null;
  rawText: string;
  parsed: ParsedQuestion;
  error: string;
};

type QuestionField = keyof ParsedQuestion;

const EMPTY_QUESTION: ParsedQuestion = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "",
};

function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeItemId, setActiveItemId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null;
  const completedCount = items.filter((item) => item.status === "completed").length;
  const pendingCount = items.filter((item) => item.status === "queued" || item.status === "failed").length;

  useEffect(() => {
    if (!activeItem) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(activeItem.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeItem?.id]);

  function addFiles(selectedFiles: FileList | File[]) {
    setError("");
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    for (const nextFile of Array.from(selectedFiles)) {
      if (!ACCEPTED_TYPES.includes(nextFile.type)) {
        rejectedFiles.push(`${nextFile.name}: unsupported format`);
      } else if (nextFile.size > MAX_FILE_SIZE) {
        rejectedFiles.push(`${nextFile.name}: larger than 12 MB`);
      } else {
        validFiles.push(nextFile);
      }
    }

    const availableSlots = Math.max(0, MAX_QUEUE_SIZE - items.length);
    const acceptedFiles = validFiles.slice(0, availableSlots);
    const newItems = acceptedFiles.map((file): QueueItem => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
      result: null,
      rawText: "",
      parsed: { ...EMPTY_QUESTION },
      error: "",
    }));

    if (newItems.length) {
      setItems((current) => [...current, ...newItems]);
      setActiveItemId((current) => current || newItems[0].id);
    }
    const notices = [...rejectedFiles];
    if (validFiles.length > acceptedFiles.length) {
      notices.push(`Queue limit is ${MAX_QUEUE_SIZE} images.`);
    }
    if (notices.length) setError(notices.slice(0, 3).join(". "));
  }

  async function processQueue() {
    const pendingItems = items.filter((item) => item.status === "queued" || item.status === "failed");
    if (isProcessing || pendingItems.length === 0) return;

    setIsProcessing(true);
    setError("");
    setProgress({ current: 0, total: pendingItems.length, fileName: "" });

    for (let index = 0; index < pendingItems.length; index += 1) {
      const item = pendingItems[index];
      setActiveItemId(item.id);
      setProgress({ current: index + 1, total: pendingItems.length, fileName: item.file.name });
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, status: "processing", error: "" } : entry,
      ));

      try {
        const result = await recognizeImage(item.file);
        const rawText = result.pages[0]?.text ?? "";
        setItems((current) => current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "completed", result, rawText, parsed: parseQuestion(rawText), error: "" }
            : entry,
        ));
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "OCR could not be completed.";
        setItems((current) => current.map((entry) =>
          entry.id === item.id ? { ...entry, status: "failed", error: message } : entry,
        ));
      }
    }

    setProgress(null);
    setIsProcessing(false);
  }

  async function exportWorkbook() {
    const completedItems = items.filter((item) => item.status === "completed");
    if (!completedItems.length) return;

    const data = await buildQuestionWorkbook(completedItems.map((item) => ({
      image: item.file.name,
      question: item.parsed,
    })));
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "question-extraction.xlsx";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateQuestion(id: string, field: QuestionField, value: string) {
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, parsed: { ...item.parsed, [field]: value } } : item,
    ));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (activeItemId === id) {
      setActiveItemId(items.find((item) => item.id !== id)?.id ?? "");
    }
  }

  function clearQueue() {
    setItems([]);
    setActiveItemId("");
    setProgress(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="Image to Text home">
          <span className="brand-mark"><ScanText size={19} strokeWidth={2.2} /></span>
          <span>folio<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-meta">
          <span className="engine-indicator"><span /> Local OCR</span>
          <span className="topbar-divider" />
          <button className="language-control" type="button" aria-label="Language: English">
            English <ChevronDown size={14} />
          </button>
        </div>
      </header>

      <section className="workspace" id="workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">BATCH WORKSPACE <span>01</span></p>
            <h1>Questions to spreadsheet</h1>
            <p className="subheading">Extract one question per photo, review the options, then export.</p>
          </div>
          <div className="privacy-note"><span className="privacy-dot" /> Local OCR · sequential queue</div>
        </div>

        <button
          className={`upload-zone${isDragging ? " is-dragging" : ""}`}
          type="button"
          disabled={isProcessing}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <span className="upload-icon"><ArrowUpFromLine size={21} /></span>
          <span className="upload-title">Drop photos here to build a batch</span>
          <span className="upload-detail">or <span className="browse-link">browse multiple files</span></span>
          <span className="file-types">PNG · JPG · WEBP <i /> UP TO 12 MB EACH <i /> UP TO {MAX_QUEUE_SIZE} PHOTOS</span>
        </button>

        {error && <div className="error-message" role="alert"><CircleAlert size={16} />{error}</div>}
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={isProcessing}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <section className="queue-panel" aria-label="Image queue">
          <div className="queue-heading">
            <div>
              <div className="queue-title">Processing queue <span>{items.length}</span></div>
              <div className="queue-subtitle">{completedCount} complete · {pendingCount} waiting or failed</div>
            </div>
            <div className="queue-actions">
              {items.length > 0 && (
                <button className="text-button" type="button" onClick={clearQueue} disabled={isProcessing}>Clear queue</button>
              )}
              <button className="primary-button" type="button" onClick={processQueue} disabled={isProcessing || pendingCount === 0}>
                {isProcessing ? <LoaderCircle className="spin" size={16} /> : <Play size={15} />}
                {isProcessing ? `Processing ${progress?.current ?? 0} of ${progress?.total ?? items.length}` : pendingCount ? `Process ${pendingCount} photos` : "Queue is clear"}
              </button>
              <button className="export-button" type="button" onClick={exportWorkbook} disabled={completedCount === 0} title="Export completed questions to Excel">
                <Download size={16} /> Excel <span>{completedCount}</span>
              </button>
            </div>
          </div>

          {progress && <div className="progress-caption"><span className="progress-dot" /> Working on {progress.fileName}</div>}

          {items.length > 0 ? (
            <div className="queue-list">
              {items.map((item, index) => (
                <div className={`queue-row${activeItem?.id === item.id ? " is-active" : ""}`} key={item.id}>
                  <button className="queue-select" type="button" onClick={() => setActiveItemId(item.id)}>
                    <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
                    <FileImage size={16} />
                    <span className="queue-file-name">{item.file.name}</span>
                    <span className="queue-file-size">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </button>
                  <span className={`status-tag status-${item.status}`}>
                    {item.status === "processing" && <LoaderCircle className="spin" size={12} />}
                    {item.status === "completed" && <Check size={12} />}
                    {item.status === "failed" && <CircleAlert size={12} />}
                    {item.status}
                  </span>
                  <button className="icon-button" type="button" onClick={() => removeItem(item.id)} disabled={isProcessing} aria-label={`Remove ${item.file.name}`} title="Remove from queue"><X size={15} /></button>
                  {item.error && <span className="queue-error" title={item.error}>{item.error}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="queue-empty"><FileText size={17} /> Selected photos will appear here.</div>
          )}
        </section>

        {activeItem && (
          <div className="workbench review-workbench">
            <section className="pane source-pane" aria-label="Selected source image">
              <div className="pane-header">
                <div className="pane-title"><FileImage size={15} /> Selected photo</div>
                <span className="pane-caption">{activeItem.status.toUpperCase()}</span>
              </div>
              <div className="image-stage">
                {previewUrl && <img src={previewUrl} alt={`Uploaded document: ${activeItem.file.name}`} />}
              </div>
              <div className="source-footer"><span>{activeItem.file.name}</span><span>Image {items.findIndex((item) => item.id === activeItem.id) + 1} of {items.length}</span></div>
            </section>

            <section className="pane text-pane" aria-label="Raw OCR text">
              <div className="pane-header">
                <div className="pane-title"><FileText size={15} /> OCR text</div>
                {activeItem.result && <span className="pane-caption">{activeItem.result.engine.name.toUpperCase()}</span>}
              </div>
              {activeItem.status === "completed" ? (
                <pre className="raw-text">{activeItem.rawText || "No text detected in this image."}</pre>
              ) : activeItem.status === "failed" ? (
                <div className="empty-result"><CircleAlert size={20} /><strong>Could not process this image</strong><span>{activeItem.error}</span></div>
              ) : (
                <div className="empty-result"><ScanText size={20} /><strong>{activeItem.status === "processing" ? "Recognizing text…" : "Waiting in queue"}</strong><span>Photos are processed one at a time.</span></div>
              )}
              <div className="text-footer">{activeItem.result ? `${activeItem.result.metadata.processing_time_ms} ms` : "English · PaddleOCR"}</div>
            </section>
          </div>
        )}

        {completedCount > 0 && (
          <section className="results-panel" aria-label="Editable question rows">
            <div className="results-heading">
              <div>
                <div className="queue-title">Question rows <span>{completedCount}</span></div>
                <div className="queue-subtitle">Review and edit fields before exporting. Correct answers are left blank.</div>
              </div>
              <span className="sheet-mark"><FileText size={14} /> XLSX</span>
            </div>
            <div className="spreadsheet-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Image</th><th>Question</th><th>Option A</th><th>Option B</th><th>Option C</th><th>Option D</th><th>Correct Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter((item) => item.status === "completed").map((item) => (
                    <tr key={item.id} onClick={() => setActiveItemId(item.id)} className={activeItem?.id === item.id ? "row-selected" : ""}>
                      <td className="result-file" title={item.file.name}>{item.file.name}</td>
                      {([
                        ["question", item.parsed.question],
                        ["optionA", item.parsed.optionA],
                        ["optionB", item.parsed.optionB],
                        ["optionC", item.parsed.optionC],
                        ["optionD", item.parsed.optionD],
                        ["correctAnswer", item.parsed.correctAnswer],
                      ] as Array<[QuestionField, string]>).map(([field, value]) => (
                        <td key={field} onClick={(event) => event.stopPropagation()}>
                          <input
                            className="cell-input"
                            aria-label={`${field} for ${item.file.name}`}
                            value={value}
                            placeholder={field === "correctAnswer" ? "Add answer" : "Not detected"}
                            onChange={(event) => updateQuestion(item.id, field, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      <footer className="app-footer"><span>FOLIO <i /> QUESTION EXTRACTION</span><span>{items.length} PHOTOS <i /> {completedCount} EXTRACTED</span></footer>
    </main>
  );
}

export default App;