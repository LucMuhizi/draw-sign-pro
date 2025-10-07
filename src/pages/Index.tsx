import { useState } from "react";
import { ActionBar } from "@/components/ActionBar";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SignatureCreator } from "@/components/SignatureCreator";

const Index = () => {
  const [activeAction, setActiveAction] = useState<string>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<string>("");

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
            </div>
          )}

          {activeAction === "signature" && (
            <SignatureCreator onSignatureCreate={handleSignatureCreate} />
          )}

          {activeAction === "add-signature" && (
            <div className="text-center py-12">
              <h1 className="text-3xl font-bold text-foreground mb-2">Document Signing</h1>
              <p className="text-muted-foreground mb-8">Place your signature on the document</p>
              {selectedFile && signature ? (
                <div className="bg-card rounded-2xl p-8 shadow-soft">
                  <div className="aspect-[3/4] bg-accent/30 rounded-xl mb-4 flex items-center justify-center">
                    <p className="text-muted-foreground">Document preview with signature placement</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors">
                      Clear
                    </button>
                    <button className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover transition-colors">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Please upload a document and create a signature first
                </div>
              )}
            </div>
          )}

          {activeAction === "download" && (
            <div className="text-center py-12">
              <h1 className="text-3xl font-bold text-foreground mb-2">Download</h1>
              <p className="text-muted-foreground mb-8">Download your signed document</p>
              <div className="bg-card rounded-2xl p-8 shadow-soft">
                <p className="text-muted-foreground">Your signed documents will appear here</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
