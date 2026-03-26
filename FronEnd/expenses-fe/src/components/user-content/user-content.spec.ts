import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserContent } from './user-content';

describe('UserContent', () => {
  let component: UserContent;
  let fixture: ComponentFixture<UserContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserContent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserContent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
