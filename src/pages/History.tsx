import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Trash2, ArrowLeft, FileText, Share2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getDocumentHistory, getDocumentDownloadUrl, deleteDocumentRecord, type DocumentRecord } from '@/lib/documentHistory';
import { toast } from 'sonner';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { hapticLight, hapticHeavy, hapticSuccess } from '@/lib/haptics';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { SkeletonListItem } from '@/components/Skeleton';

function SwipeableCard({
  record,
  onDelete,
  onDownload,
  deleting,
  index,
}: {
  record: DocumentRecord;
  onDelete: (id: string) => void;
  onDownload: (record: DocumentRecord) => void;
  deleting: boolean;
  index: number;
}) {
  const x = useMotionValue(0);
  const trashOpacity = useTransform(x, [-80, -40], [1, 0]);
  const showAlert = useTransform(x, [-120, -80], [1, 0]);
  const deleteThreshold = -120;

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < deleteThreshold) {
      hapticHeavy();
      setShowConfirm(true);
    } else {
      const anim = document.getElementById(`swipe-card-${record.id}`);
      if (anim) {
        anim.style.transition = 'transform 0.3s ease';
        anim.style.transform = 'translateX(0)';
        setTimeout(() => {
          anim.style.transition = '';
          anim.style.transform = '';
        }, 300);
      }
    }
  }, [record.id, onDelete, deleteThreshold]);

  const [showConfirm, setShowConfirm] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      hapticLight();
      setShowConfirm(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground rounded-xl"
          style={{ width: Math.abs(deleteThreshold), opacity: 1 }}
        >
          <motion.div style={{ opacity: showAlert }}>
            <Trash2 className="w-5 h-5" />
          </motion.div>
        </div>
        <motion.div
          id={`swipe-card-${record.id}`}
          style={{ x }}
          drag="x"
          dragConstraints={{ left: deleteThreshold, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          dragSnapToOrigin
          whileTap={{ cursor: 'grabbing' }}
        >
          <Card className="p-5 flex items-center justify-between bg-white/60 backdrop-blur-xl border border-border/50 hover:shadow-soft transition-shadow duration-200">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{record.original_filename}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(record.signed_at).toLocaleDateString()} &middot; {record.page_count} page{record.page_count !== 1 ? 's' : ''} &middot; {record.signature_count} signature{record.signature_count !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {record.storage_path && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDownload(record); }} className="border-primary/30 hover:border-primary/60 rounded-xl">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
                disabled={deleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {showConfirm && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6"
          onClick={() => setShowConfirm(false)}
        >
          <Card
            className="p-6 w-full max-w-xs bg-white/90 backdrop-blur-xl border border-border/50 shadow-xl rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-2" />
              <h3 className="font-semibold text-foreground">Delete Document?</h3>
              <p className="text-sm text-muted-foreground mt-1">This action cannot be undone</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowConfirm(false);
                  hapticSuccess();
                  onDelete(record.id);
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </>
  );
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login?redirect=/history');
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await getDocumentHistory(user.id);
      setRecords(data);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const handleDownload = async (record: DocumentRecord) => {
    if (!record.storage_path) {
      toast.error('No signed file available');
      return;
    }
    const url = await getDocumentDownloadUrl(record.storage_path);
    if (!url) {
      toast.error('Failed to get download link');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = record.original_filename;
    link.click();
    toast.success('Downloading signed document');
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await deleteDocumentRecord(id);
    setDeleting(null);
    if (error) {
      toast.error('Failed to delete record');
      return;
    }
    setRecords(prev => prev.filter(r => r.id !== id));
    hapticSuccess();
    toast.success('Document record removed');
  };

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    const { data } = await getDocumentHistory(user.id);
    setRecords(data);
    hapticLight();
    toast.success('History refreshed');
  }, [user]);

  const { containerProps, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: loading || records.length === 0,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex items-center gap-4"
        >
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="hover:bg-card rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Document History</h1>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 25 }}
              >
                <SkeletonListItem />
              </motion.div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card className="p-12 text-center bg-white/60 backdrop-blur-xl border border-border/50 shadow-soft">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              </motion.div>
              <h2 className="text-lg font-semibold text-foreground mb-2">No signed documents yet</h2>
              <p className="text-muted-foreground mb-4">Documents you sign will appear here</p>
              <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft rounded-xl">
                Sign a Document
              </Button>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3" {...containerProps}>
            {/* Pull-to-refresh indicator */}
            {refreshing && (
              <div className="flex justify-center py-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {records.map((record, i) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
              >
                <SwipeableCard
                  record={record}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  deleting={deleting === record.id}
                  index={i}
                />
              </motion.div>
            ))}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Swipe left or long press to delete
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
