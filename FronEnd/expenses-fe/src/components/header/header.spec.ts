import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('logout button exists', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const logoutBtn = Array.from(buttons).find((btn: any) => btn.textContent.includes('SignOut'));
    expect(logoutBtn).toBeTruthy();
  });
});
