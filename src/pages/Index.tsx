import { useState } from "react";
import { ActionBar } from "@/components/ActionBar";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SignatureCreator } from "@/components/SignatureCreator";
import { DocumentViewer } from "@/components/DocumentViewer";

const Index = () => {
  const [activeAction, setActiveAction] = useState<string>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [placedSignaturesCount, setPlacedSignaturesCount] = useState<number>(0);

  const handleActionClick = (action: string) => {
    setActiveAction(action);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleSignatureCreate = (sig: string) => {
    setSignature(sig);
  };

  return (
    <div className="min-h-screen bg-background">
      <ActionBar activeAction={activeAction} onActionClick={handleActionClick} />
      
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-2xl mx-auto">
          {activeAction === "upload" && (
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Upload Document</h1>
              <p className="text-muted-foreground mb-8 text-center">Start by uploading your document</p>
              <DocumentUpload onFileSelect={handleFileSelect} />
              <div className="mt-6 flex justify-center">
                <button
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  onClick={() => setActiveAction('signature')}
                  disabled={!selectedFile}
                >
                  Next: Signature
                </button>
              </div>
            </div>
          )}

          {activeAction === "signature" && (
            <div>
              <SignatureCreator onSignatureCreate={handleSignatureCreate} />
              <div className="mt-6 flex justify-center">
                <button
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  onClick={() => setActiveAction('add-signature')}
                  disabled={!signature}
                >
                  Next: Place Signature
                </button>
              </div>
            </div>
          )}

          {activeAction === "add-signature" && (
            <div>
              {selectedFile && signature ? (
                <DocumentViewer
                  file={selectedFile}
                  signature={signature}
                  onBack={() => setActiveAction("upload")}
                  onSignaturePlaced={(count) => setPlacedSignaturesCount(count)}
                />
              ) : (
                <div className="text-center py-12">
                  <h1 className="text-3xl font-bold text-foreground mb-2">Document Signing</h1>
                  <p className="text-muted-foreground mb-8">Place your signature on the document</p>
                  <div className="text-muted-foreground">
                    Please upload a document and create a signature first
                  </div>
                </div>
              )}
              {/* Add a next button to move to download if signatures have been placed */}
              {selectedFile && signature && (
                <div className="mt-6 flex justify-center">
                  <button
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                    onClick={() => setActiveAction('download')}
                    disabled={placedSignaturesCount === 0}
                  >
                    Next: Download
                  </button>
                </div>
              )}
            </div>
          )}

          {activeAction === "download" && (
            <div>
              {selectedFile && signature ? (
                <DocumentViewer
                  file={selectedFile}
                  signature={signature}
                  onBack={() => setActiveAction("upload")}
                />
              ) : (
                <div className="text-center py-12">
                  <h1 className="text-3xl font-bold text-foreground mb-2">Download</h1>
                  <p className="text-muted-foreground mb-8">Download your signed document</p>
                  <div className="bg-card rounded-2xl p-8 shadow-soft">
                    <p className="text-muted-foreground">Please upload a document and create a signature first</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
