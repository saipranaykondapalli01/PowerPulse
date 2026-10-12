package com.powerpulse.settings;


public class SimulationConfig {

    private boolean enabled = true;
    private int intervalSeconds = 10;
    private double noiseFactor = 1.0;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getIntervalSeconds() {
        return intervalSeconds;
    }

    public void setIntervalSeconds(int intervalSeconds) {
        this.intervalSeconds = intervalSeconds;
    }

    public double getNoiseFactor() {
        return noiseFactor;
    }

    public void setNoiseFactor(double noiseFactor) {
        this.noiseFactor = noiseFactor;
    }
}
