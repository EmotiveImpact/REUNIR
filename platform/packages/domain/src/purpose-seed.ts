import type { Workspace } from '../../contracts/src/index';
/** Fictional sample data only. Never used by the production community-creation path. */
export function seedPurpose(s: Workspace): Workspace {
    const base=(id:string)=>({id,organizationId:s.organisation.id,createdAt:'2026-09-24T08:00:00.000Z'});
    s.purposes=[
        {...base('purpose_become'),kind:'become',title:'Become a confident creative.',description:'Develop your craft through practice, honest feedback and work you can point to.',status:'active'},
        {...base('purpose_build'),kind:'build',title:'Make things that matter.',description:'Small teams. Real briefs. Films, products and ideas that leave the group chat.',status:'active'},
        {...base('purpose_achieve'),kind:'achieve',title:'Take your next real step.',description:'Finish a first version, start a useful conversation and show the evidence.',status:'active'},
    ];
    s.paths=[
        {...base('path_product'),purposeId:'purpose_build',spaceId:null,title:'From idea to something useful',summary:'Learn the essentials, test a first version and contribute to a real project.',status:'published'},
        {...base('path_film'),purposeId:'purpose_become',spaceId:null,title:'Tell your first visual story',summary:'Find a feeling. Make a short film. Bring your craft to a team.',status:'published'},
        {...base('path_offer'),purposeId:'purpose_achieve',spaceId:null,title:'Make your first clear offer',summary:'Turn a skill into a useful offer, then begin one respectful conversation.',status:'published'},
    ];
    s.milestones=[
        {...base('step_product_1'),pathId:'path_product',title:'Choose one real problem',description:'Begin with a person, not a list of features.',position:1,lessonId:'lesson_4',missionId:null,projectId:null},
        {...base('step_product_2'),pathId:'path_product',title:'Find the useful first version',description:'Complete the lesson and choose what to leave out.',position:2,lessonId:'lesson_5',missionId:null,projectId:null},
        {...base('step_product_3'),pathId:'path_product',title:'Put your idea in someone’s hands',description:'Submit mission proof and receive a community review.',position:3,lessonId:null,missionId:'mission_prototype',projectId:null},
        {...base('step_product_4'),pathId:'path_product',title:'Contribute to Common Ground',description:'A recognised contribution, not simply joining the team.',position:4,lessonId:null,missionId:null,projectId:'project_common'},
        {...base('step_film_1'),pathId:'path_film',title:'Start with a feeling',description:'Choose the change you want your audience to feel.',position:1,lessonId:'lesson_1',missionId:null,projectId:null},
        {...base('step_film_2'),pathId:'path_film',title:'Make your 30-second story',description:'Get feedback on a finished piece of work.',position:2,lessonId:null,missionId:'mission_film',projectId:null},
        {...base('step_film_3'),pathId:'path_film',title:'Bring your craft to After Hours',description:'Make and record a contribution the team can recognise.',position:3,lessonId:null,missionId:null,projectId:'project_afterhours'},
        {...base('step_offer_1'),pathId:'path_offer',title:'Make the value obvious',description:'Learn to make a clear, bounded promise.',position:1,lessonId:'lesson_9',missionId:null,projectId:null},
        {...base('step_offer_2'),pathId:'path_offer',title:'Start a useful conversation',description:'Submit a reflection without private customer information.',position:2,lessonId:null,missionId:'mission_offer',projectId:null},
    ];
    s.pathEnrolments=[{...base('path_enrol_alex'),pathId:'path_product',userId:'member_alex'}];
    s.memberGoals=[{...base('goal_alex'),userId:'member_alex',purposeId:'purpose_build',pathId:'path_product',title:'Build a useful prototype and contribute to a real launch.',visibility:'private',status:'active',completedAt:null,outcomeId:null}];
    for(const p of s.projects)p.purposeId='purpose_build';
    s.contributions=[{...base('contribution_notes'),projectId:'project_notes',userId:'member_sofia',title:'Edited the first Notes issue',body:'Fictional sample: shaped the editorial brief, edited the opening essay and assembled the first issue with the team.',evidenceUrl:'',status:'recognised',reviewerId:'member_amina',reviewedAt:'2026-09-24T08:30:00.000Z',feedback:'The first issue is complete and the editorial contribution is clear.'}];
    // Nia accepted a credit on Sofia's recognised contribution. The credit adds nothing to Nia's paths or recognition.
    s.contributionCredits=[{...base('credit_nia_notes'),contributionId:'contribution_notes',projectId:'project_notes',userId:'member_nia',invitedBy:'member_sofia',role:'Photography',status:'accepted',respondedAt:'2026-09-24T09:00:00.000Z',withdrawnBy:null,withdrawnAt:null}];
    s.outcomes=[{...base('outcome_notes'),purposeId:'purpose_build',projectId:'project_notes',submissionId:null,contributionId:'contribution_notes',authorId:'member_sofia',title:'Notes from the studio: issue 01',summary:'A fictional community-made publication bringing together writing, photography and the lessons behind the work.',evidenceUrl:'',status:'verified',reviewerId:'member_amina',reviewedAt:'2026-09-24T08:45:00.000Z',feedback:'The output and the contribution have been reviewed by the community team.'}];
    // Nia accepted Sofia's credit on the outcome too, so the archived output reads "With Nia James". It adds nothing to Nia's goals.
    s.outcomeCredits=[{...base('outcome_credit_nia_notes'),outcomeId:'outcome_notes',projectId:'project_notes',userId:'member_nia',invitedBy:'member_sofia',role:'Photography',status:'accepted',respondedAt:'2026-09-24T09:15:00.000Z',withdrawnBy:null,withdrawnAt:null}];
    s.communityOutputs=[{...base('output_notes'),purposeId:'purpose_build',outcomeId:'outcome_notes',projectId:'project_notes',title:'Notes from the studio: issue 01',summary:'A fictional community-made publication bringing together writing, photography and the lessons behind the work.',kind:'book',evidenceUrl:'',publishedBy:'member_amina'}];
    s.projectTasks = [
      ['task_test', 'Test the first-run experience', 'Watch three independent creators use the first onboarding. Capture where they hesitate and what helps them move forward.', 'member_alex', 'todo', 'high', ['Three observed tests', 'Friction points recorded', 'One next change proposed']],
      ['task_empty', 'Design the first empty state', 'Help a new member understand what to do before their first connection. Keep the message useful, not decorative.', null, 'todo', 'normal', ['A clear next action', 'Readable on mobile']],
      ['task_flow', 'Build the profile discovery flow', 'Let a creator find a collaborator by what they make and what they need.', 'member_idris', 'doing', 'high', ['Skills can be searched', 'Profile links stay inside the community']],
      ['task_notes', 'Write the feedback session brief', 'Give reviewers a small set of concrete things to try, then leave space for what we have not anticipated.', 'member_alex', 'todo', 'normal', ['Three useful prompts', 'No private participant information']]
    ].map(([id,title,brief,assigneeId,workState,priority,criteria])=>({...base(String(id)),projectId:'project_common',title:String(title),brief:String(brief),criteria:criteria as string[],assigneeId:assigneeId as string|null,dueOn:'2026-10-02',priority:priority as 'normal'|'high',workState:workState as 'todo'|'doing',contributionId:null,createdBy:'member_idris',updatedAt:'2026-09-24T08:00:00.000Z',version:1,archived:false}));
    s.taskNotes = [{...base('task_note_seed'),projectId:'project_common',taskId:'task_test',authorId:'member_idris',body:'Start with the first screen, before explaining the idea. Record the friction without collecting personal information.',hidden:false}];
    return s;
}
