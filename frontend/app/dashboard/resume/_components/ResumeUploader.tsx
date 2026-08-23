import React, { RefObject } from 'react';

interface ResumeUploaderProps {
  dragOver: boolean;
  setDragOver: (val: boolean) => void;
  uploading: boolean;
  handleFileDrop: (e: React.DragEvent) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ResumeUploader({
  dragOver, setDragOver, uploading, handleFileDrop, fileRef, handleFileChange
}: ResumeUploaderProps) {
  return (
    <div id="resume-upload-zone"
      style={{
        borderRadius: '16px', border: '2px dashed', padding: '32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
        borderColor: dragOver ? '#6366f1' : 'rgba(255,255,255,0.1)',
        background: dragOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
        transform: dragOver ? 'scale(1.02)' : 'scale(1)',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleFileDrop}
      onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleFileChange} />
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>{uploading ? '⏳' : '📄'}</div>
      <div style={{ fontWeight: 600, color: 'white', marginBottom: '4px', fontSize: '14px' }}>
        {uploading ? 'Uploading...' : 'Drop your resume here'}
      </div>
      <div style={{ fontSize: '12px', marginBottom: '16px', color: '#4a5480' }}>PDF or DOCX · Max 10MB</div>
      <button className="btn-primary" style={{ fontSize: '13px', padding: '8px 20px' }} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Browse File'}
      </button>
    </div>
  );
}
