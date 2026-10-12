package com.powerpulse.settings;

import com.powerpulse.user.Role;
import java.util.ArrayList;
import java.util.List;

public class NotificationPrefs {

    private List<Role> criticalAlertRoles = new ArrayList<>(List.of(Role.ADMIN, Role.ENGINEER, Role.OPERATOR));
    private List<Role> offlineRoles = new ArrayList<>(List.of(Role.ADMIN, Role.ENGINEER, Role.OPERATOR));
    private List<Role> resolvedRoles = new ArrayList<>(List.of(Role.ADMIN, Role.ENGINEER));
    private int upcomingInspectionDays = 3;

    public List<Role> getCriticalAlertRoles() {
        return criticalAlertRoles;
    }

    public void setCriticalAlertRoles(List<Role> criticalAlertRoles) {
        this.criticalAlertRoles = criticalAlertRoles;
    }

    public List<Role> getOfflineRoles() {
        return offlineRoles;
    }

    public void setOfflineRoles(List<Role> offlineRoles) {
        this.offlineRoles = offlineRoles;
    }

    public List<Role> getResolvedRoles() {
        return resolvedRoles;
    }

    public void setResolvedRoles(List<Role> resolvedRoles) {
        this.resolvedRoles = resolvedRoles;
    }

    public int getUpcomingInspectionDays() {
        return upcomingInspectionDays;
    }

    public void setUpcomingInspectionDays(int upcomingInspectionDays) {
        this.upcomingInspectionDays = upcomingInspectionDays;
    }
}
