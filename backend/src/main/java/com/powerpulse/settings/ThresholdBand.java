package com.powerpulse.settings;


public class ThresholdBand {

    private double good;
    private double warn;
    private double critical;

    public double getGood() {
        return good;
    }

    public void setGood(double good) {
        this.good = good;
    }

    public double getWarn() {
        return warn;
    }

    public void setWarn(double warn) {
        this.warn = warn;
    }

    public double getCritical() {
        return critical;
    }

    public void setCritical(double critical) {
        this.critical = critical;
    }
}
