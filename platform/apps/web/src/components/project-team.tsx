import { Link } from 'react-router-dom';
import { Check, LogOut, Plus, UserMinus, UserPlus } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { useConfirm } from './confirm';
import { Avatar, Pill } from './ui';
import { Button } from './ui/button';
import { isAdmin } from '../../../../packages/domain/src/engine';
import type { Member, Project } from '../../../../packages/contracts/src/index';

/**
 * The team panel on a project page (decision 054): who is on the team, joining and leaving, and for the project's lead or
 * an administrator, removing someone and letting them back. Every step that ends a membership asks once more first.
 */
export function ProjectTeam({ project: p }: { project: Project }) {
    const { data, me, command, busy } = useWorkspace();
    const confirm = useConfirm();
    const rows = data.projectMembers.filter(x => x.projectId === p.id);
    const person = (userId: string) => data.members.find(m => m.userId === userId);
    const team = rows.filter(x => !x.leftAt).map(x => person(x.userId)).filter((m): m is Member => !!m);
    const removed = rows.filter(x => x.leftAt && x.removedBy).map(x => person(x.userId)).filter((m): m is Member => !!m && m.status === 'active');
    const joined = team.some(m => m.userId === me.userId), leads = p.ownerId === me.userId || isAdmin(me);
    type TeamCommand = Parameters<typeof command>[0];
    const ask = async (title: string, body: string, confirmText: string, cmd: TeamCommand) => { if (await confirm({ title, body, confirmText })) await command(cmd); };
    return <section className="panel">
        <Pill tone={p.status === 'launched' ? 'mint' : 'violet'}>{p.status}</Pill>
        <h2>People behind the idea</h2>
        <div className="team-list">{team.map(m => {
            const role = <><Avatar member={m} size="sm"/><span><strong>{m.name}</strong><small>{m.userId === p.ownerId ? 'Started the project' : 'Collaborator'}</small></span></>;
            const removable = leads && m.userId !== p.ownerId && m.userId !== me.userId && m.status !== 'left';
            return <div className="team-row" key={m.id}>{m.status === 'left' ? <div className="team-former">{role}</div> : <Link to={`/members/${m.userId}`}>{role}</Link>}{removable && <Button variant="ghost" className="button ghost small" disabled={busy} aria-label={`Remove ${m.name} from the team`} onClick={() => ask(`Remove ${m.name} from the team?`, 'Tasks they claimed without proof go back to the team. Their recognised work stays credited to them.', `Remove ${m.name.split(' ')[0]}`, { type: 'project.member.remove', projectId: p.id, userId: m.userId })}><UserMinus size={14}/>Remove</Button>}</div>;
        })}</div>
        {!joined && <Button variant="default" className="button primary full" disabled={busy} onClick={() => command({ type: 'project.join', projectId: p.id })}><Plus size={16}/>Join the project</Button>}
        {joined && p.ownerId === me.userId && <p className="muted"><Check size={14}/> You lead this project.</p>}
        {joined && p.ownerId !== me.userId && <Button variant="secondary" className="button secondary full" disabled={busy} onClick={() => ask(`Leave ${p.title}?`, 'Tasks you have claimed without proof go back to the team. Your recognised work stays credited to you.', 'Leave the team', { type: 'project.leave', projectId: p.id })}><LogOut size={16}/>Leave the team</Button>}
        {leads && removed.length > 0 && <div className="team-removed"><h3>Removed from the team</h3>{removed.map(m => <div className="team-row" key={m.id}><span className="team-former"><Avatar member={m} size="sm"/><span><strong>{m.name}</strong><small>Removed</small></span></span><Button variant="ghost" className="button ghost small" disabled={busy} aria-label={`Let ${m.name} back onto the team`} onClick={() => ask(`Let ${m.name} back onto the team?`, 'They are back on the team and can claim tasks again.', `Let ${m.name.split(' ')[0]} back`, { type: 'project.member.restore', projectId: p.id, userId: m.userId })}><UserPlus size={14}/>Let back</Button></div>)}</div>}
        <p className="sample-note">Joining gives you access to publish updates. Collaborate thoughtfully and respect the work.</p>
    </section>;
}
