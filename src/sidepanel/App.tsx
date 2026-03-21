import { DebugConsolePane } from './DebugConsolePane';
import { SettingsCard } from './settings';
import { ActiveWorkItemBanner } from './atoms/ActiveWorkItemBanner';
import classes from './App.module.css';
import { Tabs } from './Tabs';
import { useSidepanelController } from './useSidepanelController';
import { WorkItemCard } from './work-item';
import { StatusCard } from './work-items';

export function App() {
  const controller = useSidepanelController();

  return (
    <div className={classes.wrap}>
      <ActiveWorkItemBanner
        heading={controller.activeItemHeading}
        isPinned={controller.isActiveItemPinned}
        onClick={() => {
          void controller.onActiveItemBannerClick();
        }}
      />

      <Tabs
        activeTab={controller.activeTab}
        onSelectTab={controller.onSelectTab}
        isActiveItemPinned={controller.isActiveItemPinned}
        onTogglePinActiveItem={() => {
          void controller.onTogglePinActiveItem();
        }}
        activeItemTabLabel={controller.activeItemTabLabel}
      />

      {controller.activeTab === 'settings' ? (
        <SettingsCard
          settings={controller.settings}
          onChange={controller.onChangeSettings}
          onSave={controller.onSaveSettings}
          onReloadExtension={controller.onReloadExtension}
          isLoading={controller.isLoading}
        />
      ) : null}

      {controller.activeTab === 'work-items' ? (
        <StatusCard
          loadingMessage={controller.loadingMessage}
          isLoading={controller.isLoading}
          result={controller.result}
          closedDateRange={controller.closedDateRange}
          isClosedEndTodayShortcut={controller.isClosedEndTodayShortcut}
          showWorkItemParentDetails={controller.showWorkItemParentDetails}
          statusMessage={controller.statusMessage}
          preFetchHint={
            controller.hasFetchedOnce
              ? null
              : 'Panel reloaded. Click Fetch work items to load the latest data.'
          }
          onFetchWorkItems={controller.onFetchWorkItems}
          onClosedDateRangeChange={controller.onClosedDateRangeChange}
          onEnableCustomClosedEndDate={controller.onEnableCustomClosedEndDate}
          onResetClosedDateRange={controller.onResetClosedDateRange}
          onRefetchClosedDay={controller.onRefetchClosedDay}
          onToggleShowWorkItemParentDetails={
            controller.onToggleShowWorkItemParentDetails
          }
          isActionDisabled={controller.isActionDisabled}
          linkExternal={controller.linkExternal}
        />
      ) : null}

      {controller.activeTab === 'work-item' ? (
        <WorkItemCard
          taskTitle={controller.taskTitle}
          onTaskTitleChange={controller.onTaskTitleChange}
          onCreateTask={controller.onCreateTaskFromCurrentWorkItem}
          parentWorkItemId={controller.parentWorkItemId}
          isParentDetected={Boolean(controller.parentWorkItemId)}
          createdTasks={controller.visibleChildTasks}
          selectedTaskId={controller.selectedTaskId}
          onSelectTask={controller.onSelectTask}
          availableTaskStates={controller.availableTaskStates}
          hiddenTaskStates={controller.hiddenTaskStates}
          onToggleTaskStateFilter={controller.onToggleTaskStateFilter}
          isActionDisabled={controller.isActionDisabled}
          statusMessage={controller.createTaskStatusMessage}
          recentFeatureSuggestions={controller.recentFeatureSuggestions}
          recentParentableSuggestions={controller.recentParentableSuggestions}
          onSetFeatureParent={controller.onSetFeatureParent}
          onReparentSelectedTask={controller.onReparentSelectedTask}
          onTogglePinSuggestedParent={controller.onTogglePinSuggestedParent}
          isRecentFeaturesCollapsed={controller.isRecentFeaturesCollapsed}
          onToggleRecentFeaturesCollapsed={
            controller.onToggleRecentFeaturesCollapsed
          }
          linkExternal={controller.linkExternal}
        />
      ) : null}

      <DebugConsolePane
        entries={controller.debugLogs}
        onClear={() => {
          controller.onChangeDebugLogs([]);
        }}
      />
    </div>
  );
}
