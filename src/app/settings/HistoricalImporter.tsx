"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

interface Mapping {
  sheetName: string;
  isTransactionSheet: boolean;
  suggestedCategory: string;
  dateColumn: string;
  payeeColumn: string;
  amountColumn: string;
}

export default function HistoricalImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Success
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [results, setResults] = useState<{ transactionsCreated: number; categoriesCreated: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phase", "analyze");

      const res = await fetch("/api/v1/import/historical", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.suggestions) {
        setMappings(data.suggestions);
        setStep(2);
      } else {
        alert("Failed to analyze spreadsheet structure.");
      }
    } catch (err) {
      console.error(err);
      alert("Error analyzing file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phase", "execute");
      formData.append("year", year.toString());
      formData.append("mappings", JSON.stringify(mappings));

      const res = await fetch("/api/v1/import/historical", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setResults(data);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert("Import failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (index: number, field: keyof Mapping, value: string | boolean) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value } as Mapping;
    setMappings(newMappings);
  };

  return (
    <div className="historical-importer">
      {step === 1 && (
        <div className="step-upload animate-fade-in">
          <div className="form-group mb-4">
            <label>Target Year for Historical Data</label>
            <input 
              type="number" 
              value={year} 
              onChange={e => setYear(parseInt(e.target.value))}
              className="settings-input"
            />
          </div>
          <div className="upload-zone glass p-8 text-center border-dashed border-2">
            <input type="file" accept=".xlsx" onChange={handleFileChange} id="xlsx-upload" className="hidden" />
            <label htmlFor="xlsx-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">📊</div>
              <p>{file ? file.name : "Click to select XLSX spreadsheet"}</p>
            </label>
          </div>
          {file && (
            <Button 
              variant="primary" 
              onClick={handleAnalyze} 
              disabled={isProcessing}
              className="w-full mt-4"
            >
              {isProcessing ? "AI Analyzing Structure..." : "Analyze Spreadsheet ✨"}
            </Button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="step-mapping animate-fade-in">
          <h3>Confirm AI Mappings for {year}</h3>
          <p className="text-muted text-sm mb-4">We&apos;ve guessed the categories based on your sheets. Adjust as needed.</p>
          
          <div className="mapping-list space-y-4">
            {mappings.map((m, i) => (
              <Card key={i} className="mapping-item glass p-4">
                <div className="flex justify-between items-center mb-2">
                  <strong>Sheet: {m.sheetName}</strong>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={m.isTransactionSheet} 
                      onChange={e => updateMapping(i, "isTransactionSheet", e.target.checked)}
                    />
                    Import this sheet
                  </label>
                </div>
                
                {m.isTransactionSheet && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="form-group">
                      <label className="text-xs">Category Name</label>
                      <input 
                        type="text" 
                        value={m.suggestedCategory} 
                        onChange={e => updateMapping(i, "suggestedCategory", e.target.value)}
                        className="text-sm p-1 bg-black/20 border border-white/10 rounded w-full"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs">Date Column</label>
                      <input 
                        type="text" 
                        value={m.dateColumn} 
                        onChange={e => updateMapping(i, "dateColumn", e.target.value)}
                        className="text-sm p-1 bg-black/20 border border-white/10 rounded w-full"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs">Payee Column</label>
                      <input 
                        type="text" 
                        value={m.payeeColumn} 
                        onChange={e => updateMapping(i, "payeeColumn", e.target.value)}
                        className="text-sm p-1 bg-black/20 border border-white/10 rounded w-full"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs">Amount Column</label>
                      <input 
                        type="text" 
                        value={m.amountColumn} 
                        onChange={e => updateMapping(i, "amountColumn", e.target.value)}
                        className="text-sm p-1 bg-black/20 border border-white/10 rounded w-full"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="actions mt-6 flex gap-4">
            <Button variant="primary" onClick={handleImport} disabled={isProcessing} className="flex-1">
              {isProcessing ? "Importing Data..." : "Execute Import 🚀"}
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-success animate-fade-in text-center p-8">
          <div className="text-6xl mb-4">✅</div>
          <h2>Import Complete!</h2>
          <div className="stats glass p-4 mt-4 inline-block text-left">
            <p>Year: <strong>{year}</strong></p>
            <p>Transactions Created: <strong>{results?.transactionsCreated}</strong></p>
            <p>New Categories: <strong>{results?.categoriesCreated}</strong></p>
          </div>
          <div className="mt-6">
            <Button variant="primary" onClick={() => window.location.href = `/history/${year}`}>
              View {year} History 📈
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)} className="ml-2">Done</Button>
          </div>
        </div>
      )}

      <style jsx>{`
        .historical-importer {
          margin-top: 1rem;
        }
        .upload-zone {
          border-color: var(--glass-border);
          color: var(--text-dim);
          border-radius: 12px;
        }
        .upload-zone:hover {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.02);
        }
        .settings-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          color: white;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
