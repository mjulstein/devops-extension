import { DebugConsolePane } from './DebugConsolePane';
import { SettingsPane } from './settings';
import { ActiveWorkItemBanner } from './atoms/ActiveWorkItemBanner';
import { DeduplicateTabsButton } from './atoms/DeduplicateTabsButton';
import { StarPageToggle } from './atoms/StarPageToggle';
import { StarredPagesMenu } from './atoms/StarredPagesMenu';
import { ReconnectBanner } from './atoms/ReconnectBanner';
import classes from './App.module.css';
import { Tabs } from './Tabs';
import { useSidepanelController } from './useSidepanelController';
import { WorkItemPane } from './work-item';
import { WorkItemsPane } from './work-items';

export function App() {
  const controller = useSidepanelController();

  return (
    <div className={classes.wrap}>
      <header className={classes.bannerRow}>
        {/* The active-item banner used to live here; it now sits at the top of
            the Active item tab, where it is actually relevant. */}
        <StarPageToggle
          canStar={controller.canStarActivePage}
          isStarred={controller.isActivePageStarred}
          onToggle={controller.onToggleStarActivePage}
        />
        <StarredPagesMenu
          pages={controller.openableStarredPages}
          focusRequest={controller.starredFocusRequest}
          onOpenStarredPage={controller.onOpenStarredPage}
        />
        <DeduplicateTabsButton
          onClick={() => {
            void controller.onDeduplicateTabs();
          }}
        />
      </header>

      <Tabs
        activeTab={controller.activeTab}
        onSelectTab={controller.onSelectTab}
        isActiveItemPinned={controller.isActiveItemPinned}
        onTogglePinActiveItem={() => {
          void controller.onTogglePinActiveItem();
        }}
        activeItemTabLabel={controller.activeItemTabLabel}
      />

      {controller.isReconnectNeeded ? (
        <ReconnectBanner
          organization={controller.reconnectOrganization}
          awaitingManualRetry={controller.awaitingManualRetry}
          onReconnect={controller.onReconnect}
          onRetry={() => {
            void controller.onRetryConnection();
          }}
        />
      ) : null}

      {controller.activeTab === 'settings' ? (
        <SettingsPane
          settings={controller.settings}
          onChange={controller.onChangeSettings}
          onSave={controller.onSaveSettings}
          onReloadExtension={controller.onReloadExtension}
          starredPages={controller.starredPages}
          onUpdateStarredPage={controller.onUpdateStarredPage}
          onRemoveStarredPage={controller.onRemoveStarredPage}
          onMoveStarredPage={controller.onMoveStarredPage}
          isLoading={controller.isLoading}
        />
      ) : null}

      {controller.activeTab === 'work-items' ? (
        <WorkItemsPane
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
          onCreateQuickTask={controller.onCreateQuickTask}
          canCreateQuickTask={controller.canCreateQuickTask}
          onClosedDateRangeChange={controller.onClosedDateRangeChange}
          onEnableCustomClosedEndDate={controller.onEnableCustomClosedEndDate}
          onResetClosedDateRange={controller.onResetClosedDateRange}
          onRefetchClosedDay={controller.onRefetchClosedDay}
          onToggleShowWorkItemParentDetails={
            controller.onToggleShowWorkItemParentDetails
          }
          activeListTab={controller.activeListTab}
          onSelectListTab={(tab) => {
            void controller.onSelectListTab(tab);
          }}
          authoredItems={controller.authoredItems}
          isAuthoredLoading={controller.isAuthoredLoading}
          authoredError={controller.authoredError}
          closedParentRollup={controller.closedParentRollup}
          isClosedRollupLoading={controller.isClosedRollupLoading}
          closedRollupError={controller.closedRollupError}
          pullRequests={controller.pullRequests}
          isPullRequestsLoading={controller.isPullRequestsLoading}
          pullRequestsError={controller.pullRequestsError}
          quickTasks={controller.quickTasks}
          isQuickTasksLoading={controller.isQuickTasksLoading}
          quickTasksError={controller.quickTasksError}
          pinnedQuickTaskIds={controller.pinnedQuickTaskIds}
          quickTaskParentId={
            controller.canCreateQuickTask
              ? Number(controller.settings.quickTaskParentId.trim())
              : null
          }
          quickTaskTitle={controller.quickTaskTitle}
          onQuickTaskTitleChange={controller.onQuickTaskTitleChange}
          onCreateQuickTaskFromTitle={controller.onCreateQuickTaskFromTitle}
          onTogglePinQuickTask={controller.onTogglePinQuickTask}
          quickTaskArchiveId={controller.quickTaskArchiveId}
          onArchiveQuickTask={controller.onArchiveQuickTask}
          isActionDisabled={controller.isActionDisabled}
          linkExternal={controller.linkExternal}
        />
      ) : null}

      {controller.activeTab === 'work-item' ? (
        <>
          <ActiveWorkItemBanner
            heading={controller.activeItemHeading}
            isPinned={controller.isActiveItemPinned}
            onClick={() => {
              void controller.onActiveItemBannerClick();
            }}
          />
          <WorkItemPane
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
        </>
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
