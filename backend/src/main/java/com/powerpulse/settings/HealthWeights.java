package com.powerpulse.settings;


public class HealthWeights {

    private double temperature = 30;
    private double oilLevel = 25;
    private double load = 20;
    private double electrical = 15;
    private double faultHistory = 10;

    public double getTemperature() {
        return temperature;
    }

    public void setTemperature(double temperature) {
        this.temperature = temperature;
    }

    public double getOilLevel() {
        return oilLevel;
    }

    public void setOilLevel(double oilLevel) {
        this.oilLevel = oilLevel;
    }

    public double getLoad() {
        return load;
    }

    public void setLoad(double load) {
        this.load = load;
    }

    public double getElectrical() {
        return electrical;
    }

    public void setElectrical(double electrical) {
        this.electrical = electrical;
    }

    public double getFaultHistory() {
        return faultHistory;
    }

    public void setFaultHistory(double faultHistory) {
        this.faultHistory = faultHistory;
    }
}
