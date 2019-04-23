import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable'; 
import { Group } from '../_models/group.model';
import { AuthProvider } from '../_services/auth.service';
import { UtilitiesService } from '../_services/utilities.service';
import { AngularFirestore, AngularFirestoreDocument, AngularFirestoreCollection } from 'angularfire2/firestore';
import * as firebase from 'firebase/app'; 
import { ifError } from 'assert';

@Injectable()
export class GroupsService {
  constructor( private afStore: AngularFirestore, private authService: AuthProvider, private utilitiesService: UtilitiesService) {
    
  }

  // Get all groups from database
  getAllGroups(): any {
    const groupRef: AngularFirestoreCollection<any> = this.afStore.collection(`groups`);

    return groupRef.valueChanges()
  }

  // Create a new group and set up document
  createGroup(group: Group) {
    this.setGroupDocument(group);
  }

  private setGroupDocument(group) {

    // To generate a random group ID I have adapted the code from the link below. 
    // Math.random() is not truly random but it takes a lot of iterations to see similarities.
    // It gets a string of 15 random letters and numbers.
    // https://stackoverflow.com/a/8084248
    let randomGroupId = Math.random().toString(36).substr(2, 15);

    // Get the signed in user details which is used to populate the first group memeber (owner)
    // And build up object to be saved to database
    this.authService.getSignedInUserDetails().subscribe(data =>{
      const newGroup: Group = { 
        groupId: randomGroupId,
        groupName: group.groupName,
        groupDescription: group.groupDescription,
        profileImage: group.profilePicture,
        groupMembers: [
          { 
            username: data.username,
            email: data.email,
            owner: true,
          }
        ],
      };

      // Set the group id which will load on the home page
      // And get reference to a new document on the Firestore with the new random group id
      sessionStorage.setItem ("groupId", randomGroupId);
      const groupRef: AngularFirestoreDocument<any> = this.afStore.doc(`groups/${newGroup.groupId}`);

      // Write object to the database
      groupRef.set(newGroup);
    });
  }

  addUserToGroup(groupId: string) {
    
    // Get the current signed in user details.
    this.authService.getSignedInUserDetails().subscribe(data =>{

      // Set reference to the group document on firestore.
      const groupRef: AngularFirestoreDocument<any> = this.afStore.doc(`groups/${groupId}`);
      let groupArray: any;

      // I was finding it hard to get the code to run in the sequence I wanted so that the search result would be ready
      // when it checked if the returned value was true/false.
      // From research online I found that a Promise would solve this as it will wait till a promise is returned
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then

      // Start a Promise to check the group array to see if the currently signed in user is already in the group, 
      // if so resolve (return) "Fail", and if not found resolve "Success"
      var promise = new Promise(function(resolve, reject) {

        // Get group document from firebase
        groupRef.get().subscribe((doc) => {
          
          // Get the members array from the document
          groupArray = doc.get('groupMembers');

          // Search array to see if it constains 
          for (let element of groupArray) {
            if (element.email == data.email){
              resolve('Fail');
              return;
            }
          }

          resolve('Success');
        });
      });
      
      // When the promise above returns run the rest of code to either display error message or add user to group.
      promise.then((value) => {

        if (value == "Success"){
          // Set up user object
          let user = {
            username: data.username,
            email: data.email,
            owner: false,
          };

          // As group array has already been returned in initial search there's no need to waste
          // resources to get it again, so add new user to array and merge with database.
          groupArray.push(user);
          groupRef.set({ groupMembers: groupArray }, { merge: true });

          this.utilitiesService.presentToast("Group successfully joined.");
        }
        else {
          // Display error message, if user is in group
          this.utilitiesService.presentToast("You're already a member of this group.");
        }
      }); // promise.then
    }); // Get signed in user
  }
}
