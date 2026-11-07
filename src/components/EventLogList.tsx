// Recent Incident Telemetry Log component
import React, { useState } from 'react';
import { IncidentRecord } from '../types';
import { Clock, ShieldAlert, CheckCircle, Smartphone, AlertCircle, Download, Trash2, Check } from 'lucide-react';

interface EventLogListProps {
  incidents: IncidentRecord[];
  onClearHistory?: () => void;
}

export const EventLogList: React.FC<EventLogListProps> = ({ incidents, onClearHistory }) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleExportJSON = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(incidents, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `accidentguard-incidents-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.warn('Failed to export incident logs:', err);
    }
  };

  if (incidents.length === 0) {
    return (
      <div className="event-log-empty">
        <Clock size={24} className="text-slate-500 mb-2" />
        <p className="text-slate-400 text-sm font-semibold">No safety incidents recorded in this session.</p>
        <span className="text-slate-500 text-xs mt-1">Run a simulation scenario in the drive view or sensors bench to generate telemetry event logs.</span>
      </div>
    );
  }

  const getClassificationBadge = (classification: IncidentRecord['classification']) => {
    switch (classification) {
      case 'SEVERE_COLLISION':
        return (
          <span className="badge badge-danger">
            <ShieldAlert size={12} className="mr-1" />
            CRITICAL IMPACT
          </span>
        );
      case 'ROLLOVER':
        return (
          <span className="badge badge-danger">
            <ShieldAlert size={12} className="mr-1" />
            ROLLOVER DETECTED
          </span>
        );
      case 'FALSE_ALARM_USER_CANCELLED':
        return (
          <span className="badge badge-warning">
            <CheckCircle size={12} className="mr-1" />
            USER CANCELLED ("I'M OK")
          </span>
        );
      case 'FALSE_ALARM_STILLNESS_FAILED':
        return (
          <span className="badge badge-info">
            <Smartphone size={12} className="mr-1" />
            FALSE ALARM (MOTION CONTINUED)
          </span>
        );
      default:
        return (
          <span className="badge badge-neutral">
            <AlertCircle size={12} className="mr-1" />
            RECORDED EVENT
          </span>
        );
    }
  };

  return (
    <div className="event-log-container">
      {/* Action Toolbar: Export JSON & Clear */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-slate-400 font-mono">
          Showing {incidents.length} recorded event{incidents.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="copy-btn"
            onClick={handleExportJSON}
            title="Download telemetry trace log as JSON"
          >
            {downloadSuccess ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Exported</span>
              </>
            ) : (
              <>
                <Download size={13} />
                <span>Export Log</span>
              </>
            )}
          </button>
          {onClearHistory && (
            <button
              type="button"
              className="copy-btn hover:border-red-500/50 hover:text-red-400"
              onClick={onClearHistory}
              title="Clear event log history"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div className="event-log-list">
        {incidents.map((event) => {
          const timeStr = new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });

          return (
            <div key={event.id} className="event-log-item">
              <div className="event-item-top">
                {getClassificationBadge(event.classification)}
                <span className="event-timestamp">{timeStr}</span>
              </div>

              <div className="event-item-metrics">
                <div className="metric-chip">
                  <span className="label">Peak Shock:</span>
                  <span className="val">{event.peakG.toFixed(1)}g</span>
                </div>
                <div className="metric-chip">
                  <span className="label">Tumble Rate:</span>
                  <span className="val">{event.peakRotation.toFixed(0)}°/s</span>
                </div>
                <div className="metric-chip">
                  <span className="label">Location:</span>
                  <span className="val">
                    {event.location.lat.toFixed(3)}, {event.location.lng.toFixed(3)}
                  </span>
                </div>
              </div>

              <p className="event-notes">{event.notes}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
