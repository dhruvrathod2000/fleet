package service

import (
	"context"

	"github.com/fleetdm/fleet/server/contexts/viewer"
	"github.com/fleetdm/fleet/server/kolide"
	"github.com/pkg/errors"
)

func (svc Service) ListHosts(ctx context.Context, opt kolide.HostListOptions) ([]*kolide.Host, error) {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionList); err != nil {
		return nil, err
	}

	vc, ok := viewer.FromContext(ctx)
	if !ok {
		return nil, kolide.ErrNoContext
	}
	filter := kolide.TeamFilter{User: vc.User, IncludeObserver: true}

	return svc.ds.ListHosts(filter, opt)
}

func (svc Service) GetHost(ctx context.Context, id uint) (*kolide.HostDetail, error) {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionRead); err != nil {
		return nil, err
	}

	host, err := svc.ds.Host(id)
	if err != nil {
		return nil, errors.Wrap(err, "get host")
	}

	// Authorize again with team loaded now that we have team_id
	if err := svc.authz.Authorize(ctx, host, kolide.ActionRead); err != nil {
		return nil, err
	}

	return svc.getHostDetails(ctx, host)
}

func (svc Service) HostByIdentifier(ctx context.Context, identifier string) (*kolide.HostDetail, error) {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionRead); err != nil {
		return nil, err
	}

	host, err := svc.ds.HostByIdentifier(identifier)
	if err != nil {
		return nil, errors.Wrap(err, "get host by identifier")
	}

	// Authorize again with team loaded now that we have team_id
	if err := svc.authz.Authorize(ctx, host, kolide.ActionRead); err != nil {
		return nil, err
	}

	return svc.getHostDetails(ctx, host)
}

func (svc Service) getHostDetails(ctx context.Context, host *kolide.Host) (*kolide.HostDetail, error) {
	if err := svc.ds.LoadHostSoftware(host); err != nil {
		return nil, errors.Wrap(err, "load host software")
	}

	labels, err := svc.ds.ListLabelsForHost(host.ID)
	if err != nil {
		return nil, errors.Wrap(err, "get labels for host")
	}

	packs, err := svc.ds.ListPacksForHost(host.ID)
	if err != nil {
		return nil, errors.Wrap(err, "get packs for host")
	}

	return &kolide.HostDetail{Host: *host, Labels: labels, Packs: packs}, nil
}

func (svc Service) GetHostSummary(ctx context.Context) (*kolide.HostSummary, error) {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionList); err != nil {
		return nil, err
	}
	vc, ok := viewer.FromContext(ctx)
	if !ok {
		return nil, kolide.ErrNoContext
	}
	filter := kolide.TeamFilter{User: vc.User, IncludeObserver: true}

	online, offline, mia, new, err := svc.ds.GenerateHostStatusStatistics(filter, svc.clock.Now())
	if err != nil {
		return nil, err
	}
	return &kolide.HostSummary{
		OnlineCount:  online,
		OfflineCount: offline,
		MIACount:     mia,
		NewCount:     new,
	}, nil
}

func (svc Service) DeleteHost(ctx context.Context, id uint) error {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionWrite); err != nil {
		return err
	}

	host, err := svc.ds.Host(id)
	if err != nil {
		return errors.Wrap(err, "get host for delete")
	}

	// Authorize again with team loaded now that we have team_id
	if err := svc.authz.Authorize(ctx, host, kolide.ActionWrite); err != nil {
		return err
	}

	return svc.ds.DeleteHost(id)
}

func (svc *Service) FlushSeenHosts(ctx context.Context) error {
	// No authorization check because this is used only internally.

	hostIDs := svc.seenHostSet.getAndClearHostIDs()
	return svc.ds.MarkHostsSeen(hostIDs, svc.clock.Now())
}

func (svc Service) AddHostsToTeam(ctx context.Context, teamID *uint, hostIDs []uint) error {
	// This is currently treated as a "team write". If we ever give users
	// besides global admins permissions to modify team hosts, we will need to
	// check that the user has permissions for both the source and destination
	// teams.
	if err := svc.authz.Authorize(ctx, &kolide.Team{}, kolide.ActionWrite); err != nil {
		return err
	}

	return svc.ds.AddHostsToTeam(teamID, hostIDs)
}

func (svc Service) AddHostsToTeamByFilter(ctx context.Context, teamID *uint, opt kolide.HostListOptions, lid *uint) error {
	// This is currently treated as a "team write". If we ever give users
	// besides global admins permissions to modify team hosts, we will need to
	// check that the user has permissions for both the source and destination
	// teams.
	if err := svc.authz.Authorize(ctx, &kolide.Team{}, kolide.ActionWrite); err != nil {
		return err
	}
	vc, ok := viewer.FromContext(ctx)
	if !ok {
		return kolide.ErrNoContext
	}
	filter := kolide.TeamFilter{User: vc.User, IncludeObserver: true}

	if opt.StatusFilter != "" && lid != nil {
		return kolide.NewInvalidArgumentError("status", "may not be provided with label_id")
	}

	opt.PerPage = kolide.PerPageUnlimited

	// Load hosts, either from label if provided or from all hosts.
	var hosts []*kolide.Host
	var err error
	if lid != nil {
		hosts, err = svc.ds.ListHostsInLabel(filter, *lid, opt)
	} else {
		hosts, err = svc.ds.ListHosts(filter, opt)
	}
	if err != nil {
		return err
	}

	if len(hosts) == 0 {
		return nil
	}

	hostIDs := make([]uint, 0, len(hosts))
	for _, h := range hosts {
		hostIDs = append(hostIDs, h.ID)
	}

	// Apply the team to the selected hosts.
	return svc.ds.AddHostsToTeam(teamID, hostIDs)
}

func (svc *Service) RefetchHost(ctx context.Context, id uint) error {
	if err := svc.authz.Authorize(ctx, &kolide.Host{}, kolide.ActionRead); err != nil {
		return err
	}

	host, err := svc.ds.Host(id)
	if err != nil {
		return errors.Wrap(err, "find host for refetch")
	}

	if err := svc.authz.Authorize(ctx, host, kolide.ActionRead); err != nil {
		return err
	}

	host.RefetchRequested = true
	if err := svc.ds.SaveHost(host); err != nil {
		return errors.Wrap(err, "save host")
	}

	return nil
}
