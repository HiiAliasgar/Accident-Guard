// Recent Incident Telemetry Log component
import React from 'react';
import { IncidentRecord } from '../types';
import { Clock, ShieldAlert, CheckCircle, Smartphone, AlertCircle } from 'lucide-react';

interface EventLogListProps {
  incidents: IncidentRecord[];
}

export const EventLogList: React.FC<EventLogListProps> = ({ incidents }) => {
  if (incidents.length === 0) {
    return (
      <div className="event-log-empty">
        <Clock size={20} className="text-slate-500 mb-2" />
        <p className="text-slate-400 text-sm">No safety incidents recorded in this session.</p>
        <span className="text-slate-500 text-xs">Run a simulation scenario above to generate an event trace.</span>
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
