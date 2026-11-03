package com.accidentguard.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Foreground Activity-bound sensor bridge.
 *
 * This plugin intentionally does not claim background monitoring. A dedicated,
 * user-started foreground service is still required for reliable background
 * driving sessions and must be implemented and tested separately.
 */
@CapacitorPlugin(name = "NativeSensorBridge")
public class NativeSensorBridgePlugin extends Plugin implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor gyroscope;
    private boolean running = false;
    private long samplingPeriodUs = 20000;
    private float ax = 0f;
    private float ay = 0f;
    private float az = SensorManager.GRAVITY_EARTH;
    private float gx = 0f;
    private float gy = 0f;
    private float gz = 0f;
    private long lastGyroTimestampNanos = 0L;

    @PluginMethod
    public void start(PluginCall call) {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            call.reject("Android sensor service is unavailable");
            return;
        }

        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
        if (accelerometer == null) {
            call.reject("This device does not have an accelerometer");
            return;
        }

        samplingPeriodUs = Math.max(10000, Math.min(100000, call.getInt("samplingPeriodUs", 20000)));
        stopSensors();
        boolean accelRegistered = sensorManager.registerListener(
            this, accelerometer, (int) samplingPeriodUs
        );
        if (!accelRegistered) {
            call.reject("Unable to register the Android accelerometer listener");
            return;
        }
        if (gyroscope != null) {
            sensorManager.registerListener(this, gyroscope, (int) samplingPeriodUs);
        }
        running = true;

        JSObject result = new JSObject();
        result.put("accelerometerAvailable", true);
        result.put("gyroscopeAvailable", gyroscope != null);
        result.put("samplingPeriodUs", samplingPeriodUs);
        result.put("backgroundMonitoring", false);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopSensors();
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", running);
        result.put("accelerometerAvailable", accelerometer != null);
        result.put("gyroscopeAvailable", gyroscope != null);
        result.put("backgroundMonitoring", false);
        call.resolve(result);
    }

    private void stopSensors() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        running = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running || event == null || event.values == null) return;

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER && event.values.length >= 3) {
            ax = event.values[0];
            ay = event.values[1];
            az = event.values[2];
            emitFrame(event.timestamp);
        } else if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE && event.values.length >= 3) {
            final float radiansToDegrees = (float) (180.0 / Math.PI);
            gx = event.values[0] * radiansToDegrees;
            gy = event.values[1] * radiansToDegrees;
            gz = event.values[2] * radiansToDegrees;
            lastGyroTimestampNanos = event.timestamp;
        }
    }

    private void emitFrame(long sensorTimestampNanos) {
        JSObject frame = new JSObject();
        frame.put("x", ax);
        frame.put("y", ay);
        frame.put("z", az);
        // Android gyroscope axes are device-relative. Mapping is provisional;
        // phone mounting/orientation calibration is needed for vehicle-frame features.
        boolean gyroFresh = lastGyroTimestampNanos > 0L
            && sensorTimestampNanos >= lastGyroTimestampNanos
            && sensorTimestampNanos - lastGyroTimestampNanos <= 250000000L;
        frame.put("alpha", gyroFresh ? gz : 0f);
        frame.put("beta", gyroFresh ? gx : 0f);
        frame.put("gamma", gyroFresh ? gy : 0f);
        // SensorEvent.timestamp uses the monotonic elapsed-realtime time base.
        frame.put("monotonicTimestampMs", sensorTimestampNanos / 1000000.0);
        notifyListeners("sensorFrame", frame);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Accuracy is surfaced by Android itself; stale-frame checks run in TypeScript.
    }
}
